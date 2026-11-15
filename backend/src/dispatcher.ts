import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import type { DynamoDBStreamEvent, Handler, ScheduledEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { db, getItem, key, tableName, type Item } from './store.js';

interface OutboxRecord extends Item {
  effectId: string;
  type: 'REFRESH' | 'AGENT_RUN' | 'MEMORY_SYNC' | 'MEMORY_EXTRACT' | 'PARTY_SYNC' | 'PARTY_NOTES';
  partyId: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DELIVERED';
  attempts?: number;
  dueAt: string;
}

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 3 });
const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: process.env.AWS_REGION ?? 'us-east-2',
  service: 'appsync',
  sha256: Sha256,
});

function assertRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function publishRefresh(record: OutboxRecord): Promise<void> {
  const endpoint = new URL(assertRequiredEnv('EVENTS_HTTP_ENDPOINT'));
  const channel = `party/${record.partyId}`;
  const event = JSON.stringify({ changeId: String(record.payload.changeId) });
  const body = JSON.stringify({ channel, events: [event] });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    ...(endpoint.port ? { port: Number(endpoint.port) } : {}),
    method: 'POST',
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      host: endpoint.host,
      'content-type': 'application/json',
    },
    body,
  });
  const signed = await signer.sign(request);
  const headers = new Headers(signed.headers as Record<string, string>);
  // fetch supplies Host from the URL; the signer included the same value in the canonical request.
  headers.delete('host');
  const response = await fetch(endpoint, { method: 'POST', headers, body });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`AppSync publish returned HTTP ${response.status}`);
  if (!responseText) return;
  try {
    const result = JSON.parse(responseText) as { failed?: unknown[] };
    if (Array.isArray(result.failed) && result.failed.length > 0) {
      throw new Error('AppSync rejected a refresh event');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'AppSync rejected a refresh event') throw error;
    // A successful HTTP acknowledgment may have an empty or non-JSON body.
  }
}

async function enqueueAgent(record: OutboxRecord): Promise<void> {
  await sqs.send(new SendMessageCommand({
    QueueUrl: assertRequiredEnv('AGENT_QUEUE_URL'),
    MessageBody: JSON.stringify({
      effectId: record.effectId,
      runId: record.payload.runId,
      partyId: record.partyId,
      triggerMessageId: record.payload.triggerMessageId,
    }),
    MessageGroupId: record.partyId,
    MessageDeduplicationId: record.effectId,
  }));
}

async function enqueueMemory(record: OutboxRecord): Promise<void> {
  const type = record.type;
  let body: Record<string, unknown>;
  let groupId: string;
  if (type === 'MEMORY_SYNC') {
    const ownerId = String(record.payload.ownerId ?? record.partyId);
    const factId = record.payload.factId;
    const version = record.payload.version;
    if (!ownerId || typeof factId !== 'string' || !factId || !Number.isInteger(version) || Number(version) < 1) {
      throw new Error('Invalid MEMORY_SYNC outbox payload');
    }
    body = { effectId: record.effectId, type, ownerId, factId, version };
    groupId = ownerId;
  } else if (type === 'MEMORY_EXTRACT') {
    const partyId = String(record.payload.partyId ?? record.partyId);
    const triggerMessageId = record.payload.triggerMessageId;
    const expectedRevision = record.payload.expectedRevision;
    if (!partyId || typeof triggerMessageId !== 'string' || !triggerMessageId ||
        !Number.isInteger(expectedRevision) || Number(expectedRevision) < 0) {
      throw new Error('Invalid MEMORY_EXTRACT outbox payload');
    }
    body = {
      effectId: record.effectId,
      type,
      partyId,
      triggerMessageId,
      force: record.payload.force === true,
      expectedRevision,
    };
    groupId = partyId;
  } else {
    const partyId = String(record.payload.partyId ?? record.partyId);
    const messageId = record.payload.messageId;
    if (!partyId || typeof messageId !== 'string' || !messageId) {
      throw new Error('Invalid PARTY_SYNC outbox payload');
    }
    body = { effectId: record.effectId, type, partyId, messageId };
    groupId = type === 'PARTY_NOTES' ? `notes-${partyId}` : partyId;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: assertRequiredEnv('MEMORY_QUEUE_URL'),
    MessageBody: JSON.stringify(body),
    MessageGroupId: groupId,
    MessageDeduplicationId: record.effectId,
  }));
}

async function markDelivered(record: OutboxRecord): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: tableName(),
    Key: key(`OUTBOX#${record.effectId}`, 'META'),
    UpdateExpression: 'SET #status = :delivered, deliveredAt = :now, #ttl = :ttl REMOVE GSI2PK, GSI2SK',
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':delivered': 'DELIVERED',
      ':pending': 'PENDING',
      ':now': new Date().toISOString(),
      ':ttl': Math.floor(Date.now() / 1_000) + 7 * 86_400,
    },
  }));
}

async function postpone(record: OutboxRecord, error: unknown): Promise<void> {
  const attempt = Number(record.attempts ?? 0) + 1;
  const delaySeconds = Math.min(300, 2 ** Math.min(attempt, 8));
  const dueAt = new Date(Date.now() + delaySeconds * 1_000).toISOString();
  await db.send(new UpdateCommand({
    TableName: tableName(),
    Key: key(`OUTBOX#${record.effectId}`, 'META'),
    UpdateExpression: 'SET attempts = :attempts, dueAt = :dueAt, GSI2SK = :gsi2sk, lastError = :lastError',
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':pending': 'PENDING',
      ':attempts': attempt,
      ':dueAt': dueAt,
      ':gsi2sk': `${dueAt}#${record.effectId}`,
      ':lastError': error instanceof Error ? error.name : 'DispatchError',
    },
  }));
  console.error(JSON.stringify({ type: 'outbox_delivery_failed', effectId: record.effectId, effectType: record.type, attempt }));
}

async function dispatchEffect(effectId: string): Promise<void> {
  const item = await getItem(`OUTBOX#${effectId}`, 'META');
  if (!item || item.status !== 'PENDING') return;
  const record = item as OutboxRecord;
  if (Date.parse(record.dueAt) > Date.now()) return;
  try {
    if (record.type === 'REFRESH') await publishRefresh(record);
    else if (record.type === 'AGENT_RUN') await enqueueAgent(record);
    else if (record.type === 'MEMORY_SYNC' || record.type === 'MEMORY_EXTRACT' || record.type === 'PARTY_SYNC' || record.type === 'PARTY_NOTES') {
      await enqueueMemory(record);
    }
    else throw new Error('Unknown outbox effect type');
    await markDelivered(record);
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return;
    await postpone(record, error);
  }
}

async function handleStream(event: DynamoDBStreamEvent): Promise<void> {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) continue;
    const item = unmarshall(record.dynamodb.NewImage as never);
    if (item.entityType !== 'OUTBOX' || item.status !== 'PENDING' || typeof item.effectId !== 'string') continue;
    await dispatchEffect(item.effectId);
  }
}

async function handleRecovery(): Promise<void> {
  let lastKey: Item | undefined;
  let processed = 0;
  do {
    const now = `${new Date().toISOString()}#~`;
    const page = await db.send(new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pending AND GSI2SK <= :now',
      ExpressionAttributeValues: {
        ':pending': 'OUTBOX#PENDING#0',
        ':now': now,
      },
      ScanIndexForward: true,
      Limit: 100,
      ExclusiveStartKey: lastKey,
    }));
    const items = (page.Items ?? []).filter((item) => typeof item.effectId === 'string');
    for (const item of items) {
      await dispatchEffect(String(item.effectId));
      processed += 1;
      if (processed >= 500) return;
    }
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
}

export const handler: Handler<DynamoDBStreamEvent | ScheduledEvent> = async (event) => {
  if ('Records' in event) {
    await handleStream(event);
    return;
  }
  await handleRecovery();
};
