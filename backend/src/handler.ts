import { createHash, randomBytes } from 'node:crypto';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from 'aws-lambda';
import { QueryCommand, UpdateCommand, type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { AgentRun, Message, MessagePage, Party, SendResult } from '@vibe/shared';
import { ulid } from 'ulid';
import { z } from 'zod';
import {
  AppError,
  db,
  forbidden,
  getItem,
  getOrCreateProfile,
  isTransactionCanceled,
  key,
  makeOutboxItem,
  membershipCheck,
  membershipItem,
  memoryExtractOutboxItem,
  notFound,
  partySyncOutboxItem,
  partyMembershipRevisionUpdate,
  queryItems,
  refreshOutboxItem,
  requireParty,
  tableName,
  toMember,
  toParty,
  toProfile,
  toRun,
  transact,
  type Item,
  type JwtClaims,
} from './store.js';
import { isVibeMention, memberRemovalPermission } from './domain.js';
import {
  createMemory,
  deleteMemory,
  exportMemories,
  getMemories,
  getPartyMemoryFacts,
  updateMemory,
  updatePartyMemorySharing,
} from './memory-routes.js';

const partyInput = z.object({
  name: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(1).max(1_000),
});
const profileInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  learningEnabled: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.learningEnabled !== undefined);
const messageInput = z.object({
  text: z.string().trim().min(1).max(4_000),
  clientId: z.uuid(),
});
const pageInput = z.object({ limit: z.coerce.number().int().min(1).max(50).default(50) });

function response(statusCode: number, body?: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function claimsFrom(event: APIGatewayProxyEventV2WithJWTAuthorizer): JwtClaims {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  return {
    sub: claims.sub,
    ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
    ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
  };
}

function parseBody<T>(event: APIGatewayProxyEventV2WithJWTAuthorizer, schema: z.ZodType<T>): T {
  try {
    const source = event.body ?? '';
    const text = event.isBase64Encoded ? Buffer.from(source, 'base64').toString('utf8') : source;
    const value = JSON.parse(text || '{}') as unknown;
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Request body is invalid.');
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

function queryLimit(event: APIGatewayProxyEventV2WithJWTAuthorizer): number {
  const parsed = pageInput.safeParse({ limit: event.queryStringParameters?.limit });
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Page limit must be between 1 and 50.');
  return parsed.data.limit;
}

function parseCursor(cursor: string | undefined, partyId: string): Item | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (value.v !== 1 || value.partyId !== partyId || typeof value.sk !== 'string' || !value.sk.startsWith('MSG#')) {
      throw new Error('bad cursor');
    }
    return { PK: `PARTY#${partyId}`, SK: value.sk };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'The message cursor is invalid for this party.');
  }
}

function encodeCursor(partyId: string, lastKey: Item): string | undefined {
  if (typeof lastKey.SK !== 'string') return undefined;
  return Buffer.from(JSON.stringify({ v: 1, partyId, sk: lastKey.SK })).toString('base64url');
}

function mapMessage(item: Item): Message {
  return {
    id: String(item.id),
    partyId: String(item.partyId),
    authorId: String(item.authorId),
    authorName: String(item.authorName),
    role: item.role === 'assistant' ? 'assistant' : 'user',
    text: String(item.text),
    createdAt: String(item.createdAt),
    ...(typeof item.runId === 'string' ? { runId: item.runId } : {}),
  };
}

function rateLimitUpdate(PK: string, SK: string, limit: number, ttl: number) {
  return {
    Update: {
      TableName: tableName(),
      Key: key(PK, SK),
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)',
      ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':limit': limit,
        ':ttl': ttl,
      },
    },
  };
}

function agentRateKeys(partyId: string, userId: string, now: Date) {
  const hourStart = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
  const dayStart = Math.floor(now.getTime() / 86_400_000) * 86_400_000;
  const hourWindow = new Date(hourStart).toISOString();
  const dayWindow = new Date(dayStart).toISOString();
  const ttl = Math.floor(now.getTime() / 1_000) + 2 * 86_400;
  const party = key(`RATE#party#${partyId}`, `WINDOW#${hourWindow}`);
  const user = key(`RATE#user#${userId}`, `WINDOW#${dayWindow}`);
  return {
    party,
    user,
    updates: [
      rateLimitUpdate(String(party.PK), String(party.SK), 30, ttl),
      rateLimitUpdate(String(user.PK), String(user.SK), 100, ttl),
    ],
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createParty(claims: JwtClaims, event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<Party> {
  const input = parseBody(event, partyInput);
  const profile = await getOrCreateProfile(claims);
  const partyId = ulid();
  const createdAt = new Date().toISOString();
  const party: Party = { id: partyId, ...input, ownerId: claims.sub, createdAt };
  const partyItem: Item = {
    ...key(`PARTY#${partyId}`, 'META'),
    entityType: 'PARTY',
    membershipRevision: 0,
    ...party,
  };
  const ownerMembership = membershipItem(partyId, claims.sub, profile.name, createdAt, 'owner');
  await transact([
    {
      Put: {
        TableName: tableName(),
        Item: partyItem,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Put: {
        TableName: tableName(),
        Item: ownerMembership,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ]);
  return party;
}

async function listParties(userId: string): Promise<{ parties: Party[] }> {
  const memberships: Item[] = [];
  let lastKey: Item | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :user AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':user': `USER#${userId}`, ':prefix': 'PARTY#' },
      ExclusiveStartKey: lastKey,
    }));
    memberships.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);

  const verified = await Promise.all(memberships.map(async (membership) => {
    const partyId = typeof membership.partyId === 'string' ? membership.partyId : '';
    if (!partyId || !await getItem(`PARTY#${partyId}`, `MEMBER#${userId}`)) return undefined;
    const party = await getItem(`PARTY#${partyId}`, 'META');
    return party ? toParty(party) : undefined;
  }));
  return { parties: verified.filter((party): party is Party => party !== undefined) };
}

async function getParty(partyId: string, userId: string): Promise<Party> {
  return requireParty(partyId, userId);
}

async function listMembers(partyId: string, userId: string): Promise<{ members: ReturnType<typeof toMember>[] }> {
  await requireParty(partyId, userId);
  const page = await queryItems({ PK: `PARTY#${partyId}`, beginsWith: 'MEMBER#', consistentRead: true });
  return { members: page.items.map(toMember).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)) };
}

async function removeMember(partyId: string, targetId: string, claims: JwtClaims): Promise<void> {
  const party = await getItem(`PARTY#${partyId}`, 'META');
  if (!party) throw notFound('Party not found.');
  const ownerId = String(party.ownerId);
  const permission = memberRemovalPermission(ownerId, claims.sub, targetId);
  if (permission === 'owner-cannot-leave') {
    throw new AppError(409, 'OWNER_CANNOT_LEAVE', 'The party owner cannot leave this party.');
  }
  if (permission === 'forbidden') throw forbidden();
  if (!await getItem(`PARTY#${partyId}`, `MEMBER#${targetId}`)) throw notFound('Party member not found.');
  const refresh = refreshOutboxItem(partyId);
  const actions: NonNullable<TransactWriteCommandInput['TransactItems']> = [];
  // A self-leave Delete condition is already the membership check; DynamoDB
  // forbids two transaction actions from targeting the same item.
  if (targetId !== claims.sub) actions.push(membershipCheck(partyId, claims.sub));
  actions.push(
    {
      Delete: {
        TableName: tableName(),
        Key: key(`PARTY#${partyId}`, `MEMBER#${targetId}`),
        ConditionExpression: 'attribute_exists(PK)',
      },
    },
    partyMembershipRevisionUpdate(partyId, Number(party.membershipRevision ?? 0)),
    { Put: { TableName: tableName(), Item: refresh, ConditionExpression: 'attribute_not_exists(PK)' } },
  );
  try {
    await transact(actions);
  } catch (error) {
    if (isTransactionCanceled(error)) {
      if (!await getItem(`PARTY#${partyId}`, `MEMBER#${claims.sub}`)) throw forbidden();
      if (!await getItem(`PARTY#${partyId}`, `MEMBER#${targetId}`)) throw notFound('Party member not found.');
      throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Party membership changed in another session. Reload and try again.');
    }
    throw error;
  }
}

async function createInvite(partyId: string, claims: JwtClaims): Promise<{ token: string; expiresAt: string }> {
  await requireParty(partyId, claims.sub);
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = new Date(now + 7 * 86_400_000).toISOString();
  const tokenId = tokenHash(token);
  try {
    await transact([
      membershipCheck(partyId, claims.sub),
      {
        Put: {
          TableName: tableName(),
          Item: {
            ...key(`INVITE#${tokenId}`, 'META'),
            entityType: 'INVITE',
            partyId,
            createdBy: claims.sub,
            createdAt: new Date(now).toISOString(),
            expiresAt,
            ttl: Math.floor(new Date(expiresAt).getTime() / 1_000),
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ]);
  } catch (error) {
    if (isTransactionCanceled(error) && !await getItem(`PARTY#${partyId}`, `MEMBER#${claims.sub}`)) throw forbidden();
    throw error;
  }
  return { token, expiresAt };
}

async function joinInvite(token: string, claims: JwtClaims): Promise<Party> {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) throw notFound('Invite not found.');
  const tokenId = tokenHash(token);
  const invite = await getItem(`INVITE#${tokenId}`, 'META');
  if (!invite) throw notFound('Invite not found.');
  const partyId = String(invite.partyId);
  const partyItem = await getItem(`PARTY#${partyId}`, 'META');
  if (!partyItem) throw notFound('Party not found.');
  if (await getItem(`PARTY#${partyId}`, `MEMBER#${claims.sub}`)) return toParty(partyItem);
  const expiresAt = typeof invite.expiresAt === 'string' ? invite.expiresAt : '';
  if (!expiresAt || Date.parse(expiresAt) <= Date.now()) {
    throw new AppError(410, 'INVITE_EXPIRED', 'This invite has expired.');
  }
  const profile = await getOrCreateProfile(claims);
  const membership = membershipItem(partyId, claims.sub, profile.name, new Date().toISOString(), 'member');
  const refresh = refreshOutboxItem(partyId);
  try {
    await transact([
      {
        ConditionCheck: {
          TableName: tableName(),
          Key: key(`INVITE#${tokenId}`, 'META'),
          ConditionExpression: 'attribute_exists(PK) AND expiresAt > :now',
          ExpressionAttributeValues: { ':now': new Date().toISOString() },
        },
      },
      {
        Put: {
          TableName: tableName(),
          Item: membership,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      partyMembershipRevisionUpdate(partyId, Number(partyItem.membershipRevision ?? 0)),
      {
        Put: { TableName: tableName(), Item: refresh, ConditionExpression: 'attribute_not_exists(PK)' },
      },
    ]);
  } catch (error) {
    if (isTransactionCanceled(error)) {
      if (await getItem(`PARTY#${partyId}`, `MEMBER#${claims.sub}`)) return toParty(partyItem);
      const currentInvite = await getItem(`INVITE#${tokenId}`, 'META');
      if (!currentInvite || typeof currentInvite.expiresAt !== 'string' || Date.parse(currentInvite.expiresAt) <= Date.now()) {
        throw new AppError(410, 'INVITE_EXPIRED', 'This invite has expired.');
      }
      throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Party membership changed in another session. Reload and try again.');
    }
    throw error;
  }
  return toParty(partyItem);
}

async function listMessages(
  partyId: string,
  userId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<MessagePage> {
  await requireParty(partyId, userId);
  const limit = queryLimit(event);
  const exclusiveStartKey = parseCursor(event.queryStringParameters?.cursor, partyId);
  const page = await db.send(new QueryCommand({
    TableName: tableName(),
    KeyConditionExpression: 'PK = :party AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':party': `PARTY#${partyId}`, ':prefix': 'MSG#' },
    ConsistentRead: true,
    ScanIndexForward: false,
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey,
  }));
  const messages = (page.Items ?? []).map(mapMessage).reverse();
  const runIds = [...new Set(messages.flatMap((message) => message.runId ? [message.runId] : []))];
  const runs: AgentRun[] = (await Promise.all(runIds.map((runId) => getItem(`PARTY#${partyId}`, `RUN#${runId}`))))
    .filter((item): item is Item => item !== undefined)
    .map(toRun);
  const nextCursor = page.LastEvaluatedKey ? encodeCursor(partyId, page.LastEvaluatedKey) : undefined;
  return { messages, ...(nextCursor ? { nextCursor } : {}), runs };
}

async function sendMessage(partyId: string, claims: JwtClaims, event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<SendResult> {
  const input = parseBody(event, messageInput);
  await requireParty(partyId, claims.sub);
  const clientKey = key(`PARTY#${partyId}`, `CLIENT#${claims.sub}#${input.clientId}`);
  const previous = await getItem(String(clientKey.PK), String(clientKey.SK));
  if (previous && previous.result && typeof previous.result === 'object') return previous.result as SendResult;

  const profile = await getOrCreateProfile(claims);
  const messageId = ulid();
  const requestTime = new Date();
  const createdAt = requestTime.toISOString();
  const mentioned = isVibeMention(input.text);
  const message: Message = {
    id: messageId,
    partyId,
    authorId: claims.sub,
    authorName: profile.name,
    role: 'user',
    text: input.text,
    createdAt,
    ...(mentioned ? { runId: messageId } : {}),
  };
  const result: SendResult = {
    message,
    ...(mentioned ? {
      run: {
        id: messageId,
        partyId,
        triggerMessageId: messageId,
        status: 'queued',
        createdAt,
      },
    } : {}),
  };
  const messageItem: Item = {
    ...key(`PARTY#${partyId}`, `MSG#${messageId}`),
    entityType: 'MESSAGE',
    ...message,
    memoryRevisionAtCreation: Number(profile.memoryRevision ?? 0),
  };
  const refresh = refreshOutboxItem(partyId);
  const partySync = partySyncOutboxItem(partyId, messageId);
  const memoryExtract = profile.learningEnabled === true
    ? memoryExtractOutboxItem(partyId, messageId, mentioned, Number(profile.memoryRevision ?? 0))
    : undefined;
  const transaction: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    membershipCheck(partyId, claims.sub),
    { Put: { TableName: tableName(), Item: messageItem, ConditionExpression: 'attribute_not_exists(PK)' } },
    {
      Put: {
        TableName: tableName(),
        Item: {
          ...clientKey,
          entityType: 'SEND_IDEMPOTENCY',
          clientId: input.clientId,
          authorId: claims.sub,
          result,
          createdAt,
          ttl: Math.floor(Date.now() / 1_000) + 30 * 86_400,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    { Put: { TableName: tableName(), Item: refresh, ConditionExpression: 'attribute_not_exists(PK)' } },
    { Put: { TableName: tableName(), Item: partySync, ConditionExpression: 'attribute_not_exists(PK)' } },
    ...(memoryExtract ? [{ Put: { TableName: tableName(), Item: memoryExtract, ConditionExpression: 'attribute_not_exists(PK)' } }] : []),
  ];
  if (mentioned) {
    const run: AgentRun = result.run!;
    const runItem: Item = {
      ...key(`PARTY#${partyId}`, `RUN#${run.id}`),
      entityType: 'AGENT_RUN',
      ...run,
      authorId: claims.sub,
      leaseUntil: 0,
      attemptCount: 0,
    };
    const agentEffect = makeOutboxItem('AGENT_RUN', partyId, {
      runId: run.id,
      partyId,
      triggerMessageId: messageId,
    });
    transaction.push(
      { Put: { TableName: tableName(), Item: runItem, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: tableName(), Item: agentEffect, ConditionExpression: 'attribute_not_exists(PK)' } },
      ...agentRateKeys(partyId, claims.sub, requestTime).updates,
    );
  }
  try {
    await transact(transaction);
  } catch (error) {
    if (isTransactionCanceled(error)) {
      const duplicate = await getItem(String(clientKey.PK), String(clientKey.SK));
      if (duplicate?.result && typeof duplicate.result === 'object') return duplicate.result as SendResult;
      if (!await getItem(`PARTY#${partyId}`, `MEMBER#${claims.sub}`)) throw forbidden();
      if (mentioned) {
        const limits = agentRateKeys(partyId, claims.sub, requestTime);
        const [partyCounter, userCounter] = await Promise.all([
          getItem(String(limits.party.PK), String(limits.party.SK)),
          getItem(String(limits.user.PK), String(limits.user.SK)),
        ]);
        if (Number(partyCounter?.count ?? 0) >= 30 || Number(userCounter?.count ?? 0) >= 100) {
          throw new AppError(429, 'RATE_LIMITED', 'Vibe is receiving too many requests. Try again shortly.', true);
        }
      }
      throw new AppError(409, 'SEND_CONFLICT', 'The message could not be saved. Retry with a new client ID.', true);
    }
    throw error;
  }
  return result;
}

async function getRun(partyId: string, runId: string, userId: string): Promise<AgentRun> {
  await requireParty(partyId, userId);
  const run = await getItem(`PARTY#${partyId}`, `RUN#${runId}`);
  if (!run) throw notFound('Agent run not found.');
  return toRun(run);
}

async function updateProfile(claims: JwtClaims, event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const input = parseBody(event, profileInput);
  const previous = await getOrCreateProfile(claims);
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {
    ':id': claims.sub,
    ':email': previous.email,
    ':now': new Date().toISOString(),
  };
  const sets = ['id = :id', 'email = :email', 'updatedAt = :now'];
  if (input.name !== undefined) {
    names['#name'] = 'name';
    values[':name'] = input.name;
    sets.push('#name = :name');
  }
  const learningChanged = input.learningEnabled !== undefined && input.learningEnabled !== previous.learningEnabled;
  if (input.learningEnabled !== undefined) {
    names['#learningEnabled'] = 'learningEnabled';
    names['#memoryRevision'] = 'memoryRevision';
    values[':learningEnabled'] = input.learningEnabled;
    values[':expectedRevision'] = Number(previous.memoryRevision ?? 0);
    sets.push('#learningEnabled = :learningEnabled');
  }
  if (learningChanged) {
    values[':zero'] = 0;
    values[':one'] = 1;
    sets.push('#memoryRevision = if_not_exists(#memoryRevision, :zero) + :one');
  }
  const compareMemoryRevision = input.learningEnabled !== undefined;
  try {
    const result = await db.send(new UpdateCommand({
      TableName: tableName(),
      Key: key(`USER#${claims.sub}`, 'PROFILE'),
      UpdateExpression: `SET ${sets.join(', ')}`,
      ...(compareMemoryRevision ? { ConditionExpression: '#memoryRevision = :expectedRevision' } : {}),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return toProfile(result.Attributes ?? {
      id: claims.sub,
      email: previous.email,
      name: input.name ?? previous.name,
      learningEnabled: input.learningEnabled ?? previous.learningEnabled,
    });
  } catch (error) {
    if (compareMemoryRevision && error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      throw new AppError(409, 'MEMORY_CONFLICT', 'Your learning setting changed in another session. Reload it and try again.');
    }
    throw error;
  }
}

async function route(event: APIGatewayProxyEventV2WithJWTAuthorizer, claims: JwtClaims): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  let path = event.rawPath || '/';
  if (path === '/api') path = '/';
  else if (path.startsWith('/api/')) path = path.slice(4);
  const parts = path.split('/').filter(Boolean).map((part) => decodeURIComponent(part));

  if (parts.length === 1 && parts[0] === 'me' && method === 'GET') {
    return response(200, await getOrCreateProfile(claims));
  }
  if (parts.length === 1 && parts[0] === 'me' && method === 'PUT') {
    return response(200, await updateProfile(claims, event));
  }
  if (parts[0] === 'me' && parts[1] === 'memories' && parts.length === 2 && method === 'GET') {
    return response(200, await getMemories(claims));
  }
  if (parts[0] === 'me' && parts[1] === 'memories' && parts[2] === 'export' && parts.length === 3 && method === 'GET') {
    return response(200, await exportMemories(claims));
  }
  if (parts[0] === 'me' && parts[1] === 'memories' && parts.length === 2 && method === 'POST') {
    return response(201, await createMemory(claims, event));
  }
  if (parts[0] === 'me' && parts[1] === 'memories' && parts.length === 3 && method === 'PATCH') {
    return response(200, await updateMemory(claims, parts[2]!, event));
  }
  if (parts[0] === 'me' && parts[1] === 'memories' && parts.length === 3 && method === 'DELETE') {
    return response(200, await deleteMemory(claims, parts[2]!, event));
  }
  if (parts.length === 1 && parts[0] === 'parties' && method === 'GET') {
    return response(200, await listParties(claims.sub));
  }
  if (parts.length === 1 && parts[0] === 'parties' && method === 'POST') {
    return response(201, await createParty(claims, event));
  }
  if (parts[0] === 'parties' && parts.length === 2 && method === 'GET') {
    return response(200, await getParty(parts[1]!, claims.sub));
  }
  if (parts[0] === 'parties' && parts[2] === 'members' && parts.length === 3 && method === 'GET') {
    return response(200, await listMembers(parts[1]!, claims.sub));
  }
  if (parts[0] === 'parties' && parts[2] === 'membership' && parts.length === 3 && method === 'PATCH') {
    return response(200, await updatePartyMemorySharing(parts[1]!, claims, event));
  }
  if (parts[0] === 'parties' && parts[2] === 'facts' && parts.length === 3 && method === 'GET') {
    return response(200, await getPartyMemoryFacts(parts[1]!, claims.sub));
  }
  if (parts[0] === 'parties' && parts[2] === 'members' && parts.length === 4 && method === 'DELETE') {
    await removeMember(parts[1]!, parts[3]!, claims);
    return response(204);
  }
  if (parts[0] === 'parties' && parts[2] === 'invites' && parts.length === 3 && method === 'POST') {
    return response(201, await createInvite(parts[1]!, claims));
  }
  if (parts[0] === 'invites' && parts.length === 3 && parts[2] === 'join' && method === 'POST') {
    return response(200, await joinInvite(parts[1]!, claims));
  }
  if (parts[0] === 'parties' && parts[2] === 'messages' && parts.length === 3 && method === 'GET') {
    return response(200, await listMessages(parts[1]!, claims.sub, event));
  }
  if (parts[0] === 'parties' && parts[2] === 'messages' && parts.length === 3 && method === 'POST') {
    return response(201, await sendMessage(parts[1]!, claims, event));
  }
  if (parts[0] === 'parties' && parts[2] === 'runs' && parts.length === 4 && method === 'GET') {
    return response(200, await getRun(parts[1]!, parts[3]!, claims.sub));
  }
  return response(404, {
    code: 'NOT_FOUND',
    message: 'Route not found.',
    requestId: event.requestContext.requestId,
    retryable: false,
  });
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const requestId = event.requestContext.requestId;
  try {
    const claims = claimsFrom(event);
    return await route(event, claims);
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Try again.', true);
    if (!(error instanceof AppError)) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const diagnostic: Record<string, unknown> = { type: 'api_error', requestId, code: appError.code, errorName };
      if (error instanceof Error && [
        'ValidationException',
        'AccessDeniedException',
        'TransactionCanceledException',
        'ConditionalCheckFailedException',
        'ResourceNotFoundException',
        'ProvisionedThroughputExceededException',
        'ThrottlingException',
      ].includes(errorName)) {
        diagnostic.errorMessage = error.message.slice(0, 400);
        const reasons = (error as Error & { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
        if (Array.isArray(reasons)) diagnostic.cancellationCodes = reasons.map((reason) => reason.Code ?? 'Unknown');
      }
      console.error(JSON.stringify(diagnostic));
    }
    return response(appError.statusCode, {
      code: appError.code,
      message: appError.message,
      requestId,
      retryable: appError.retryable,
    });
  }
};
