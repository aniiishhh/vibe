import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
} from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { CreateMemoryInput, MemoryFact, MemoryList, PartyFact, UpdateMemoryInput } from '@vibe/shared';
import { ulid } from 'ulid';
import { z } from 'zod';
import {
  AppError,
  db,
  getItem,
  getOrCreateProfile,
  key,
  partyMembershipRevisionUpdate,
  requireParty,
  tableName,
  toMember,
  type Item,
  type JwtClaims,
} from './store.js';
import {
  getOwnerFact,
  getOwnerRevision,
  isFactReusable,
  listOwnerFacts,
  listPartyFacts,
  memoryFactKey,
  memorySyncOutbox,
  ownerRevisionUpdate,
  sourceTombstoneItems,
} from './memory-store.js';

const createMemoryInput = z.object({
  text: z.string().trim().min(1).max(500),
  category: z.string().trim().max(60).optional(),
  expiresAt: z.string().datetime().optional(),
  approved: z.boolean().optional(),
});

const updateMemoryInput = z.object({
  version: z.number().int().min(1),
  text: z.string().trim().min(1).max(500).optional(),
  category: z.string().trim().max(60).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  approved: z.boolean().optional(),
}).refine((value) => value.text !== undefined || value.category !== undefined || value.expiresAt !== undefined || value.approved !== undefined);

const deleteMemoryInput = z.object({ version: z.number().int().min(1) });
const membershipInput = z.object({ useSharedMemory: z.boolean() });

function body<T>(event: APIGatewayProxyEventV2WithJWTAuthorizer, schema: z.ZodType<T>): T {
  try {
    const source = event.body ?? '';
    const text = event.isBase64Encoded ? Buffer.from(source, 'base64').toString('utf8') : source;
    const parsed = schema.safeParse(JSON.parse(text || '{}') as unknown);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid.');
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

function conflict(): AppError {
  return new AppError(409, 'MEMORY_CONFLICT', 'This memory changed in another session. Reload the current version and try again.');
}

function category(value: string | undefined): string {
  return value?.trim().slice(0, 60) || 'general';
}

function renderProfilePreview(facts: MemoryFact[]): string {
  const reusable = facts.filter((fact) => isFactReusable(fact));
  return reusable.slice(0, 12).map((fact) => `- ${fact.text}`).join('\n').slice(0, 1_500);
}

export async function getMemories(claims: JwtClaims): Promise<MemoryList> {
  const profile = await getOrCreateProfile(claims);
  const memories = await listOwnerFacts(claims.sub, { includeDeleted: true });
  const extraction = await getItem(`USER#${claims.sub}`, 'PROFILE');
  return {
    memories,
    profilePreview: renderProfilePreview(memories),
    memoryRevision: Number(profile.memoryRevision ?? 0),
    ...(['pending', 'processing', 'idle', 'error'].includes(String(extraction?.extractionState))
      ? { extractionState: extraction?.extractionState as MemoryList['extractionState'], extractionUpdatedAt: String(extraction?.extractionUpdatedAt ?? '') } : {}),
  };
}

export async function createMemory(
  claims: JwtClaims,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<MemoryFact> {
  const input: CreateMemoryInput = body(event, createMemoryInput);
  const profile = await getOrCreateProfile(claims);
  const now = new Date().toISOString();
  const id = ulid();
  const approved = input.approved === true;
  const fact: MemoryFact = {
    id,
    ownerId: claims.sub,
    text: input.text,
    category: category(input.category),
    version: 1,
    approval: approved ? 'approved' : 'private',
    ...(approved ? { approvedVersion: 1 } : {}),
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    syncState: 'pending',
  };
  const memoryKey = memoryFactKey(claims.sub, id);
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName(),
            Item: { ...memoryKey, entityType: 'MEMORY_FACT', ...fact },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        ownerRevisionUpdate(claims.sub, now, Number(profile.memoryRevision ?? 0)),
        { Put: { TableName: tableName(), Item: memorySyncOutbox(claims.sub, id, fact.version), ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw conflict();
    throw error;
  }
  return fact;
}

export async function updateMemory(
  claims: JwtClaims,
  factId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<MemoryFact> {
  const input: UpdateMemoryInput = body(event, updateMemoryInput);
  const fact = await getOwnerFact(claims.sub, factId);
  if (!fact) throw new AppError(404, 'NOT_FOUND', 'Memory point not found.');
  if (fact.version !== input.version) throw conflict();
  await getOrCreateProfile(claims);

  const nextText = input.text ?? fact.text;
  const nextCategory = input.category === undefined ? fact.category : category(input.category);
  const nextExpiry = input.expiresAt === undefined ? fact.expiresAt : input.expiresAt ?? undefined;
  const contentChanged = nextText !== fact.text || nextCategory !== fact.category || nextExpiry !== fact.expiresAt;
  const nextApproval = input.approved === true
    ? 'approved'
    : input.approved === false
      ? 'private'
      : contentChanged && fact.approval === 'approved'
        ? 'private'
        : fact.approval;
  const approvalChanged = nextApproval !== fact.approval ||
    (nextApproval === 'approved' && (contentChanged || fact.approvedVersion !== fact.version));
  if (!contentChanged && !approvalChanged) return fact;

  const now = new Date().toISOString();
  const next: MemoryFact = {
    ...fact,
    text: nextText,
    category: nextCategory,
    version: fact.version + 1,
    approval: nextApproval,
    ...(nextApproval === 'approved' ? { approvedVersion: fact.version + 1 } : {}),
    ...((nextApproval !== 'approved') ? { approvedVersion: undefined } : {}),
    updatedAt: now,
    ...(nextExpiry ? { expiresAt: nextExpiry } : { expiresAt: undefined }),
    syncState: 'pending',
    syncError: undefined,
  };
  const profileRevision = await getOwnerRevision(claims.sub);
  const outbox = memorySyncOutbox(claims.sub, fact.id, next.version);
  const tombstones = contentChanged ? sourceTombstoneItems(claims.sub, fact, now) : [];
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName(),
            Item: { ...memoryFactKey(claims.sub, factId), entityType: 'MEMORY_FACT', ...next },
            ConditionExpression: 'attribute_exists(PK) AND #version = :version AND (attribute_not_exists(#deleted) OR #deleted = :false)',
            ExpressionAttributeNames: { '#version': 'version', '#deleted': 'deleted' },
            ExpressionAttributeValues: { ':version': input.version, ':false': false },
          },
        },
        ownerRevisionUpdate(claims.sub, now, profileRevision),
        { Put: { TableName: tableName(), Item: outbox, ConditionExpression: 'attribute_not_exists(PK)' } },
        ...tombstones.map((item) => ({ Put: { TableName: tableName(), Item: item } })),
      ],
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw conflict();
    throw error;
  }
  return next;
}

export async function deleteMemory(
  claims: JwtClaims,
  factId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<MemoryFact> {
  const input = body(event, deleteMemoryInput);
  const fact = await getOwnerFact(claims.sub, factId);
  if (!fact) throw new AppError(404, 'NOT_FOUND', 'Memory point not found.');
  if (fact.version !== input.version) throw conflict();
  await getOrCreateProfile(claims);

  const now = new Date().toISOString();
  const next: MemoryFact = {
    ...fact,
    version: fact.version + 1,
    approval: 'private',
    approvedVersion: undefined,
    deleted: true,
    updatedAt: now,
    syncState: 'deleting',
    syncError: undefined,
  };
  const profileRevision = await getOwnerRevision(claims.sub);
  const outbox = memorySyncOutbox(claims.sub, fact.id, next.version);
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName(),
            Item: { ...memoryFactKey(claims.sub, factId), entityType: 'MEMORY_FACT', ...next },
            ConditionExpression: 'attribute_exists(PK) AND #version = :version AND (attribute_not_exists(#deleted) OR #deleted = :false)',
            ExpressionAttributeNames: { '#version': 'version', '#deleted': 'deleted' },
            ExpressionAttributeValues: { ':version': input.version, ':false': false },
          },
        },
        ownerRevisionUpdate(claims.sub, now, profileRevision),
        { Put: { TableName: tableName(), Item: outbox, ConditionExpression: 'attribute_not_exists(PK)' } },
        ...sourceTombstoneItems(claims.sub, fact, now).map((item) => ({
          Put: { TableName: tableName(), Item: item },
        })),
      ],
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw conflict();
    throw error;
  }
  return next;
}

export async function exportMemories(claims: JwtClaims): Promise<string> {
  const facts = (await listOwnerFacts(claims.sub)).filter((fact) => !fact.deleted);
  const lines = ['# Vibe memory', '', `Exported ${new Date().toISOString()}`, ''];
  if (!facts.length) lines.push('No memory points are saved.');
  for (const fact of facts) {
    lines.push(`## ${fact.category}`, '', fact.text, '', `- Status: ${fact.approval}`, `- Source: ${fact.source}`);
    if (fact.expiresAt) lines.push(`- Expires: ${fact.expiresAt}`);
    if (fact.sourcePartyId) lines.push(`- Source party: ${fact.sourcePartyId}`);
    if (fact.sourceMessageIds?.length) lines.push(`- Source messages: ${fact.sourceMessageIds.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function updatePartyMemorySharing(
  partyId: string,
  claims: JwtClaims,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) {
  const input = body(event, membershipInput);
  await requireParty(partyId, claims.sub);
  const membershipKey = key(`PARTY#${partyId}`, `MEMBER#${claims.sub}`);
  const [membership, party] = await Promise.all([
    getItem(String(membershipKey.PK), String(membershipKey.SK)),
    getItem(`PARTY#${partyId}`, 'META'),
  ]);
  if (!membership || !party) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this party.');
  if (membership.useSharedMemory === input.useSharedMemory) return toMember(membership);
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName(),
            Key: membershipKey,
            UpdateExpression: 'SET useSharedMemory = :enabled',
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeValues: { ':enabled': input.useSharedMemory },
          },
        },
        partyMembershipRevisionUpdate(partyId, Number(party.membershipRevision ?? 0)),
      ],
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') {
      throw new AppError(409, 'MEMORY_CONFLICT', 'This party setting changed in another session. Reload and try again.');
    }
    throw error;
  }
  return toMember({ ...membership, useSharedMemory: input.useSharedMemory });
}

export async function getPartyMemoryFacts(partyId: string, userId: string): Promise<{ facts: PartyFact[] }> {
  await requireParty(partyId, userId);
  return { facts: await listPartyFacts(partyId) };
}

