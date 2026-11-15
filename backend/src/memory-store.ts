import { createHash } from 'node:crypto';
import {
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { Member, MemoryFact, MemorySyncState, PartyFact } from '@vibe/shared';
import {
  db,
  getItem,
  key,
  makeOutboxItem,
  membershipCheck,
  tableName,
  toMember,
  transact,
  type Item,
} from './store.js';

export interface ListOwnerFactsOptions {
  includeDeleted?: boolean;
}

export interface ExtractedCandidateInput {
  text: string;
  category: string;
  sourcePartyId: string;
  sourceMessageIds: string[];
  /** Revision stamped on the source messages. Kept separate from the CAS revision
   * because one extraction batch can create several candidates sequentially. */
  sourceRevision?: number;
  expectedRevision: number;
}

export type ExtractedCandidateStatus =
  | 'created'
  | 'duplicate'
  | 'source-suppressed'
  | 'revision-conflict'
  | 'learning-disabled'
  | 'source-invalid';

export interface ExtractedCandidateResult {
  status: ExtractedCandidateStatus;
  fact?: MemoryFact;
  memoryRevision: number;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function toMemoryFact(item: Item): MemoryFact {
  const syncState: MemorySyncState =
    item.syncState === 'processing' || item.syncState === 'synced' || item.syncState === 'error' || item.syncState === 'deleting'
      ? item.syncState
      : 'pending';
  return {
    id: String(item.id),
    ownerId: String(item.ownerId),
    text: String(item.text),
    category: String(item.category ?? 'general'),
    version: Number(item.version ?? 1),
    approval: item.approval === 'approved' || item.approval === 'candidate' ? item.approval : 'private',
    ...(typeof item.approvedVersion === 'number' ? { approvedVersion: item.approvedVersion } : {}),
    source: item.source === 'conversation' ? 'conversation' : 'manual',
    ...(typeof item.sourcePartyId === 'string' ? { sourcePartyId: item.sourcePartyId } : {}),
    ...(Array.isArray(item.sourceMessageIds) ? { sourceMessageIds: strings(item.sourceMessageIds) } : {}),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    ...(typeof item.expiresAt === 'string' ? { expiresAt: item.expiresAt } : {}),
    syncState,
    ...(typeof item.syncError === 'string' ? { syncError: item.syncError } : {}),
    ...(item.deleted === true ? { deleted: true } : {}),
  };
}

function toPartyFact(item: Item): PartyFact {
  return {
    id: String(item.id),
    text: String(item.text),
    speakerId: String(item.speakerId),
    sourceMessageIds: strings(item.sourceMessageIds),
    createdAt: String(item.createdAt),
  };
}

function sortNewest(items: MemoryFact[]): MemoryFact[] {
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

export async function listOwnerFacts(ownerId: string, options: ListOwnerFactsOptions = {}): Promise<MemoryFact[]> {
  const items: Item[] = [];
  let lastKey: Item | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :owner AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':owner': `USER#${ownerId}`, ':prefix': 'PREF#' },
      ConsistentRead: true,
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  const facts = items
    .filter((item) => item.entityType === 'MEMORY_FACT')
    .map(toMemoryFact)
    .filter((fact) => options.includeDeleted === true || !fact.deleted);
  return sortNewest(facts);
}

export async function getOwnerFact(
  ownerId: string,
  factId: string,
  options: ListOwnerFactsOptions = {},
): Promise<MemoryFact | undefined> {
  const item = await getItem(`USER#${ownerId}`, `PREF#${factId}`);
  if (!item || item.entityType !== 'MEMORY_FACT') return undefined;
  const fact = toMemoryFact(item);
  if (fact.deleted && options.includeDeleted !== true) return undefined;
  return fact;
}

export async function getOwnerRevision(ownerId: string): Promise<number> {
  const profile = await getItem(`USER#${ownerId}`, 'PROFILE');
  return Number(profile?.memoryRevision ?? 0);
}

export async function readPartyMembers(partyId: string): Promise<Member[]> {
  const members: Item[] = [];
  let lastKey: Item | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :party AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':party': `PARTY#${partyId}`, ':prefix': 'MEMBER#' },
      ConsistentRead: true,
      ExclusiveStartKey: lastKey,
    }));
    members.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  return Promise.all(members.map(async (item) => {
    const member = toMember(item);
    const profile = await getItem(`USER#${member.userId}`, 'PROFILE');
    return { ...member, memoryRevision: Number(profile?.memoryRevision ?? 0) };
  }));
}

export function isFactReusable(fact: MemoryFact, now = new Date()): boolean {
  if (fact.deleted || fact.approval !== 'approved' || fact.approvedVersion !== fact.version) return false;
  return !fact.expiresAt || Date.parse(fact.expiresAt) > now.getTime();
}

export async function listPartyFacts(partyId: string): Promise<PartyFact[]> {
  const items: Item[] = [];
  let lastKey: Item | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :party AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':party': `PARTY#${partyId}`, ':prefix': 'FACT#' },
      ConsistentRead: true,
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  const now = Date.now();
  return items
    .filter((item) => item.entityType === 'PARTY_FACT' && item.deleted !== true)
    .filter((item) => typeof item.expiresAt !== 'string' || Date.parse(item.expiresAt) > now)
    .map(toPartyFact)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizedText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function candidateId(input: ExtractedCandidateInput): string {
  const sourceMessageIds = [...new Set(input.sourceMessageIds)].sort();
  const fingerprint = JSON.stringify([
    input.sourcePartyId,
    sourceMessageIds,
    normalizedText(input.text),
  ]);
  return `c_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 40)}`;
}

function sourceSuppressionKey(sourcePartyId: string, sourceMessageId: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([sourcePartyId, sourceMessageId]))
    .digest('hex')
    .slice(0, 40);
  return `SUPPRESS#${digest}`;
}

export async function isMemorySourceSuppressed(ownerId: string, partyId: string, messageId: string): Promise<boolean> {
  return Boolean(await getItem(`USER#${ownerId}`, sourceSuppressionKey(partyId, messageId)));
}

export function sourceTombstoneItems(ownerId: string, fact: MemoryFact, deletedAt: string): Item[] {
  if (fact.source !== 'conversation' || !fact.sourcePartyId || !fact.sourceMessageIds?.length) return [];
  const uniqueIds = [...new Set(fact.sourceMessageIds)];
  return uniqueIds.map((sourceMessageId) => ({
    ...key(`USER#${ownerId}`, sourceSuppressionKey(fact.sourcePartyId!, sourceMessageId)),
    entityType: 'MEMORY_SOURCE_TOMBSTONE',
    ownerId,
    factId: fact.id,
    sourcePartyId: fact.sourcePartyId,
    sourceMessageId,
    createdAt: deletedAt,
  }));
}

function profileRevisionUpdate(ownerId: string, now: string, expectedRevision?: number, requireLearning = false) {
  return {
    Update: {
      TableName: tableName(),
      Key: key(`USER#${ownerId}`, 'PROFILE'),
      UpdateExpression: 'SET #revision = if_not_exists(#revision, :zero) + :one, updatedAt = :now',
      ...(expectedRevision === undefined ? { ConditionExpression: 'attribute_exists(PK)' } : {
        ConditionExpression: requireLearning
          ? 'attribute_exists(PK) AND #revision = :expected AND #learning = :enabled'
          : 'attribute_exists(PK) AND #revision = :expected',
      }),
      ExpressionAttributeNames: {
        '#revision': 'memoryRevision',
        ...(expectedRevision === undefined || !requireLearning ? {} : { '#learning': 'learningEnabled' }),
      },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':now': now,
        ...(expectedRevision === undefined ? {} : {
          ':expected': expectedRevision,
          ...(requireLearning ? { ':enabled': true } : {}),
        }),
      },
    },
  };
}

async function normalizedOwnerProfile(ownerId: string): Promise<Item | undefined> {
  const profile = await getItem(`USER#${ownerId}`, 'PROFILE');
  if (!profile) return undefined;
  if (typeof profile.memoryRevision === 'number' && typeof profile.learningEnabled === 'boolean') return profile;
  await db.send(new UpdateCommand({
    TableName: tableName(),
    Key: key(`USER#${ownerId}`, 'PROFILE'),
    UpdateExpression:
      'SET #revision = if_not_exists(#revision, :zero), #learning = if_not_exists(#learning, :disabled)',
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeNames: { '#revision': 'memoryRevision', '#learning': 'learningEnabled' },
    ExpressionAttributeValues: { ':zero': 0, ':disabled': false },
  }));
  return getItem(`USER#${ownerId}`, 'PROFILE');
}

function candidateTransaction(
  ownerId: string,
  input: ExtractedCandidateInput,
  fact: MemoryFact,
  candidatePk: string,
  candidateSk: string,
  outbox: Item,
  now: string,
): NonNullable<TransactWriteCommandInput['TransactItems']> {
  const markerKeys = [...new Set(input.sourceMessageIds)].map((messageId) =>
    key(`USER#${ownerId}`, sourceSuppressionKey(input.sourcePartyId, messageId)),
  );
  return [
    {
      Put: {
        TableName: tableName(),
        Item: {
          ...key(candidatePk, candidateSk),
          entityType: 'MEMORY_FACT',
          ...fact,
          createdRevision: input.expectedRevision + 1,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    profileRevisionUpdate(ownerId, now, input.expectedRevision, true),
    membershipCheck(input.sourcePartyId, ownerId),
    { Put: { TableName: tableName(), Item: outbox, ConditionExpression: 'attribute_not_exists(PK)' } },
    ...markerKeys.map((markerKey) => ({
      ConditionCheck: {
        TableName: tableName(),
        Key: markerKey,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    })),
  ];
}

export async function createExtractedCandidate(
  ownerId: string,
  input: ExtractedCandidateInput,
): Promise<ExtractedCandidateResult> {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  const category = (typeof input.category === 'string' ? input.category.trim() : '').slice(0, 40) || 'general';
  const sourceMessageIds = Array.isArray(input.sourceMessageIds)
    ? [...new Set(input.sourceMessageIds.filter((messageId) => typeof messageId === 'string'))].sort()
    : [];
  const memoryRevision = await getOwnerRevision(ownerId);
  const sourceRevision = input.sourceRevision ?? input.expectedRevision;
  if (
    !text || text.length > 500 ||
    typeof input.sourcePartyId !== 'string' || !input.sourcePartyId ||
    !sourceMessageIds.length || sourceMessageIds.length > 20 ||
    sourceMessageIds.some((id) => !id || id.length > 80) ||
    !Number.isInteger(sourceRevision) || sourceRevision < 0 || sourceRevision > input.expectedRevision ||
    !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
  ) {
    return { status: 'source-invalid', memoryRevision };
  }

  const id = candidateId({ ...input, text, category, sourceMessageIds });
  const candidatePk = `USER#${ownerId}`;
  const candidateSk = `PREF#${id}`;
  const existing = await getItem(candidatePk, candidateSk);
  if (existing) {
    const fact = toMemoryFact(existing);
    return {
      status: fact.deleted ? 'source-suppressed' : 'duplicate',
      fact,
      memoryRevision,
    };
  }

  const profile = await normalizedOwnerProfile(ownerId);
  if (!profile || profile.learningEnabled !== true) return { status: 'learning-disabled', memoryRevision };
  const currentRevision = Number(profile.memoryRevision ?? 0);
  if (currentRevision !== input.expectedRevision) {
    return { status: 'revision-conflict', memoryRevision: currentRevision };
  }

  const member = await getItem(`PARTY#${input.sourcePartyId}`, `MEMBER#${ownerId}`);
  if (!member) return { status: 'source-invalid', memoryRevision: currentRevision };
  const sourceItems = await Promise.all(sourceMessageIds.map((messageId) =>
    getItem(`PARTY#${input.sourcePartyId}`, `MSG#${messageId}`),
  ));
  if (sourceItems.some((item) => !item || item.authorId !== ownerId || item.role !== 'user')) {
    return { status: 'source-invalid', memoryRevision: currentRevision };
  }
  if (sourceItems.some((item) => {
    const stampedRevision = item?.memoryRevisionAtCreation;
    if (typeof stampedRevision === 'number') return stampedRevision !== sourceRevision;
    // Older messages predate revision stamping. They may be used only before
    // any memory change has advanced the profile revision.
    return currentRevision !== 0 || sourceRevision !== 0;
  })) {
    return { status: 'source-invalid', memoryRevision: currentRevision };
  }

  const markerKeys = sourceMessageIds.map((messageId) =>
    key(candidatePk, sourceSuppressionKey(input.sourcePartyId, messageId)),
  );
  const markers = await Promise.all(markerKeys.map((markerKey) => getItem(String(markerKey.PK), String(markerKey.SK))));
  if (markers.some(Boolean)) return { status: 'source-suppressed', memoryRevision: currentRevision };

  const now = new Date().toISOString();
  const nextRevision = currentRevision + 1;
  const fact: MemoryFact = {
    id,
    ownerId,
    text,
    category,
    version: 1,
    approval: 'candidate',
    source: 'conversation',
    sourcePartyId: input.sourcePartyId,
    sourceMessageIds,
    createdAt: now,
    updatedAt: now,
    syncState: 'pending',
  };
  const outbox = makeOutboxItem('MEMORY_SYNC', ownerId, { ownerId, factId: id, version: fact.version });
  try {
    await transact(candidateTransaction(
      ownerId,
      { ...input, text, category, sourceMessageIds, sourceRevision },
      fact,
      candidatePk,
      candidateSk,
      outbox,
      now,
    ));
    return { status: 'created', fact, memoryRevision: nextRevision };
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TransactionCanceledException') throw error;
    const [latest, retryFact, retryMarkers] = await Promise.all([
      normalizedOwnerProfile(ownerId),
      getItem(candidatePk, candidateSk),
      Promise.all(markerKeys.map((markerKey) => getItem(String(markerKey.PK), String(markerKey.SK)))),
    ]);
    const revision = Number(latest?.memoryRevision ?? 0);
    if (retryFact) {
      const existingFact = toMemoryFact(retryFact);
      return {
        status: existingFact.deleted ? 'source-suppressed' : 'duplicate',
        fact: existingFact,
        memoryRevision: revision,
      };
    }
    if (retryMarkers.some(Boolean)) return { status: 'source-suppressed', memoryRevision: revision };
    if (!latest || latest.learningEnabled !== true) return { status: 'learning-disabled', memoryRevision: revision };
    if (revision !== input.expectedRevision) return { status: 'revision-conflict', memoryRevision: revision };
    return { status: 'revision-conflict', memoryRevision: revision };
  }
}

export function ownerRevisionUpdate(ownerId: string, now: string, expectedRevision?: number) {
  return profileRevisionUpdate(ownerId, now, expectedRevision);
}

export function memoryFactKey(ownerId: string, factId: string) {
  return key(`USER#${ownerId}`, `PREF#${factId}`);
}

export function memorySyncOutbox(ownerId: string, factId: string, version: number): Item {
  return makeOutboxItem('MEMORY_SYNC', ownerId, { ownerId, factId, version });
}

export function partyFactKey(partyId: string, factId: string) {
  return key(`PARTY#${partyId}`, `FACT#${factId}`);
}

export function toPublicPartyFact(item: Item): PartyFact {
  return toPartyFact(item);
}
