import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { AgentRun, Member, Party, Profile } from '@vibe/shared';
import { ulid } from 'ulid';

export type Item = Record<string, unknown>;

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-2',
  maxAttempts: 3,
});
export const db = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME is not configured');
  return name;
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'The requested item was not found.') =>
  new AppError(404, 'NOT_FOUND', message);
export const unauthorized = () =>
  new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.');
export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', 'You do not have access to this party.');

export function key(PK: string, SK: string): Item {
  return { PK, SK };
}

export async function getItem(
  PK: string,
  SK: string,
  consistentRead = true,
): Promise<Item | undefined> {
  const response = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: key(PK, SK),
      ConsistentRead: consistentRead,
    }),
  );
  return response.Item;
}

export async function queryItems(input: {
  PK: string;
  beginsWith?: string;
  indexName?: string;
  consistentRead?: boolean;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: Item;
  sortKeyAtMost?: string;
}): Promise<{ items: Item[]; lastEvaluatedKey?: Item }> {
  const names: Record<string, string> = { '#pk': input.indexName ? 'GSI1PK' : 'PK' };
  const values: Record<string, unknown> = { ':pk': input.PK };
  const keyParts = ['#pk = :pk'];
  const sortKeyName = input.indexName ? 'GSI1SK' : 'SK';
  if (input.beginsWith && input.sortKeyAtMost) {
    names['#sk'] = sortKeyName;
    values[':prefix'] = input.beginsWith;
    values[':sortAtMost'] = input.sortKeyAtMost;
    keyParts.push('#sk BETWEEN :prefix AND :sortAtMost');
  } else if (input.beginsWith) {
    names['#sk'] = sortKeyName;
    values[':prefix'] = input.beginsWith;
    keyParts.push('begins_with(#sk, :prefix)');
  } else if (input.sortKeyAtMost) {
    names['#sk'] = sortKeyName;
    values[':sortAtMost'] = input.sortKeyAtMost;
    keyParts.push('#sk <= :sortAtMost');
  }
  const response = await db.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: input.indexName,
      KeyConditionExpression: keyParts.join(' AND '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConsistentRead: input.indexName ? false : (input.consistentRead ?? true),
      ScanIndexForward: input.scanIndexForward,
      Limit: input.limit,
      ExclusiveStartKey: input.exclusiveStartKey,
    }),
  );
  return {
    items: response.Items ?? [],
    lastEvaluatedKey: response.LastEvaluatedKey,
  };
}

export async function transact(items: NonNullable<TransactWriteCommandInput['TransactItems']>): Promise<void> {
  await db.send(new TransactWriteCommand({ TransactItems: items }));
}

export function membershipCheck(partyId: string, userId: string) {
  return {
    ConditionCheck: {
      TableName: tableName(),
      Key: key(`PARTY#${partyId}`, `MEMBER#${userId}`),
      ConditionExpression: 'attribute_exists(PK)',
    },
  };
}

export function membershipItem(
  partyId: string,
  userId: string,
  name: string,
  joinedAt: string,
  role: Member['role'],
): Item {
  return {
    ...key(`PARTY#${partyId}`, `MEMBER#${userId}`),
    entityType: 'MEMBER',
    partyId,
    userId,
    name,
    joinedAt,
    role,
    useSharedMemory: false,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `PARTY#${joinedAt}#${partyId}`,
  };
}

export function toMember(item: Item): Member {
  return {
    userId: String(item.userId),
    name: String(item.name),
    joinedAt: String(item.joinedAt),
    role: item.role === 'owner' ? 'owner' : 'member',
    useSharedMemory: item.useSharedMemory === true,
    ...(typeof item.memoryRevision === 'number' ? { memoryRevision: item.memoryRevision } : {}),
  };
}

export function toParty(item: Item): Party {
  return {
    id: String(item.id),
    name: String(item.name),
    goal: String(item.goal),
    ownerId: String(item.ownerId),
    createdAt: String(item.createdAt),
  };
}

export function toProfile(item: Item): Profile {
  return {
    id: String(item.id),
    name: String(item.name),
    email: String(item.email ?? ''),
    learningEnabled: item.learningEnabled === true,
    memoryRevision: Number(item.memoryRevision ?? 0),
  };
}

export function toRun(item: Item): AgentRun {
  const status = item.status;
  const runStatus: AgentRun['status'] =
    status === 'thinking' || status === 'completed' || status === 'failed' || status === 'cancelled'
      ? status
      : 'queued';
  return {
    id: String(item.id),
    partyId: String(item.partyId),
    triggerMessageId: String(item.triggerMessageId),
    status: runStatus,
    ...(typeof item.error === 'string' ? { error: item.error } : {}),
    ...(typeof item.replyMessageId === 'string' ? { replyMessageId: item.replyMessageId } : {}),
    createdAt: String(item.createdAt),
  };
}

export interface JwtClaims {
  sub: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

function fallbackName(claims: JwtClaims): string {
  const displayName = typeof claims.name === 'string' ? claims.name.trim() : '';
  if (displayName) return displayName.slice(0, 80);
  const email = typeof claims.email === 'string' ? claims.email : '';
  const localPart = email.split('@')[0]?.trim();
  return localPart || 'Vibe user';
}

export async function getOrCreateProfile(claims: JwtClaims): Promise<Profile> {
  const now = new Date().toISOString();
  const response = await db.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: key(`USER#${claims.sub}`, 'PROFILE'),
      UpdateExpression:
        'SET id = :id, email = :email, #name = if_not_exists(#name, :fallback), #learningEnabled = if_not_exists(#learningEnabled, :learningEnabled), #memoryRevision = if_not_exists(#memoryRevision, :zero), updatedAt = :now',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#learningEnabled': 'learningEnabled',
        '#memoryRevision': 'memoryRevision',
      },
      ExpressionAttributeValues: {
        ':id': claims.sub,
        ':email': typeof claims.email === 'string' ? claims.email : '',
        ':fallback': fallbackName(claims),
        ':learningEnabled': false,
        ':zero': 0,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toProfile(response.Attributes ?? { id: claims.sub, name: fallbackName(claims), email: claims.email ?? '' });
}

export async function requireParty(partyId: string, userId: string): Promise<Party> {
  const item = await getItem(`PARTY#${partyId}`, 'META');
  if (!item) throw notFound('Party not found.');
  const member = await getItem(`PARTY#${partyId}`, `MEMBER#${userId}`);
  if (!member) throw forbidden();
  return toParty(item);
}

export function makeOutboxItem(
  type: 'REFRESH' | 'AGENT_RUN' | 'MEMORY_SYNC' | 'MEMORY_EXTRACT' | 'PARTY_SYNC',
  partyId: string,
  payload: Record<string, unknown>,
): Item {
  const id = ulid();
  const dueAt = new Date().toISOString();
  return {
    ...key(`OUTBOX#${id}`, 'META'),
    entityType: 'OUTBOX',
    effectId: id,
    type,
    partyId,
    payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: dueAt,
    dueAt,
    GSI2PK: 'OUTBOX#PENDING#0',
    GSI2SK: `${dueAt}#${id}`,
  };
}

export function refreshOutboxItem(partyId: string): Item {
  const changeId = ulid();
  return makeOutboxItem('REFRESH', partyId, { changeId });
}

export function memorySyncOutboxItem(ownerId: string, factId: string, version: number): Item {
  return makeOutboxItem('MEMORY_SYNC', ownerId, { ownerId, factId, version });
}

export function memoryExtractOutboxItem(
  partyId: string,
  triggerMessageId: string,
  force: boolean,
  expectedRevision: number,
): Item {
  return makeOutboxItem('MEMORY_EXTRACT', partyId, {
    partyId,
    triggerMessageId,
    force,
    expectedRevision,
  });
}

export function partySyncOutboxItem(partyId: string, messageId: string): Item {
  return makeOutboxItem('PARTY_SYNC', partyId, { partyId, messageId });
}

export function partyMembershipRevisionUpdate(partyId: string, expectedRevision: number) {
  return {
    Update: {
      TableName: tableName(),
      Key: key(`PARTY#${partyId}`, 'META'),
      UpdateExpression: 'SET #membershipRevision = if_not_exists(#membershipRevision, :zero) + :one',
      ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(#membershipRevision) OR #membershipRevision = :expected)',
      ExpressionAttributeNames: { '#membershipRevision': 'membershipRevision' },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':expected': expectedRevision },
    },
  };
}

export function isTransactionCanceled(error: unknown): boolean {
  return error instanceof Error && error.name === 'TransactionCanceledException';
}
