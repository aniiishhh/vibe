import { QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, getItem, key, makeOutboxItem, tableName, transact, type Item } from './store.js';

export const idleMilliseconds = () => Number(process.env.MEMORY_IDLE_SECONDS ?? 120) * 1000;
export const backgroundInterval = () => Number(process.env.MEMORY_BACKGROUND_INTERVAL_SECONDS ?? 300) * 1000;

async function advancePending(Key: ReturnType<typeof key>, message: Item, indexed: boolean) {
  const due = new Date(Date.parse(String(message.createdAt)) + idleMilliseconds()).toISOString();
  try {
    await db.send(new UpdateCommand({ TableName: tableName(), Key,
      UpdateExpression: 'SET partyId = :party, lastMessageId = :message, lastActivityAt = :activity' +
        (indexed ? ', GSI2PK = :index, GSI2SK = :due' : ', ownerId = :owner'),
      ConditionExpression: 'attribute_not_exists(lastMessageId) OR lastMessageId < :message',
      ExpressionAttributeValues: { ':party': message.partyId, ':message': message.id, ':activity': message.createdAt,
        ...(indexed ? { ':index': 'MEMORY#PENDING#0', ':due': `${due}#${message.partyId}` } : { ':owner': message.authorId }) },
    }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'ConditionalCheckFailedException') throw error;
  }
}

export async function recordPendingMessage(message: Item) {
  if (message.role !== 'user' || typeof message.partyId !== 'string' || typeof message.id !== 'string') return;
  if (message.memoryLearningEnabledAtCreation === true) {
    await advancePending(key(`PARTY#${message.partyId}`, `LEARN_PENDING#${message.authorId}`), message, false);
  }
  // Write discovery last so it cannot be drained before its author marker exists.
  await advancePending(key('MEMORY_PENDING', `PARTY#${message.partyId}`), message, true);
}

export async function scheduleBackgroundMemory(now = new Date()): Promise<void> {
  if (process.env.METERED_FEATURES_ENABLED !== 'true') return;
  const page = await db.send(new QueryCommand({ TableName: tableName(), IndexName: 'GSI2', Limit: 10,
    KeyConditionExpression: 'GSI2PK = :pending AND GSI2SK <= :now',
    ExpressionAttributeValues: { ':pending': 'MEMORY#PENDING#0', ':now': `${now.toISOString()}#~` } }));
  for (const row of page.Items ?? []) {
    const pending = await getItem('MEMORY_PENDING', String(row.SK));
    if (!pending || Date.parse(String(pending.lastActivityAt)) > now.getTime() - idleMilliseconds()) continue;
    const partyId = String(pending.partyId);
    if (!await getItem(`PARTY#${partyId}`, 'META')) continue;
    const outbox = makeOutboxItem('MEMORY_EXTRACT', partyId, { partyId, triggerMessageId: pending.lastMessageId, force: true, expectedRevision: 0, background: true });
    const nextDue = new Date(now.getTime()+backgroundInterval()).toISOString();
    try {
      await transact([
        { Update: { TableName: tableName(), Key: key('MEMORY_PENDING', `PARTY#${partyId}`),
          UpdateExpression: 'SET GSI2SK = :due', ConditionExpression: 'lastMessageId = :message AND lastActivityAt <= :idle AND GSI2SK <= :now',
          ExpressionAttributeValues: { ':due': `${nextDue}#${partyId}`, ':message': pending.lastMessageId, ':idle': new Date(now.getTime()-idleMilliseconds()).toISOString(), ':now': `${now.toISOString()}#~` } } },
        { Update: { TableName: tableName(), Key: key(`PARTY#${partyId}`, 'META'),
          UpdateExpression: 'SET lastBackgroundAt = :now ADD backgroundBatchCount :one',
          ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(lastBackgroundAt) OR lastBackgroundAt <= :before)',
          ExpressionAttributeValues: { ':now': now.toISOString(), ':before': new Date(now.getTime()-backgroundInterval()).toISOString(), ':one': 1 } } },
        { Put: { TableName: tableName(), Item: outbox } },
      ]);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TransactionCanceledException') throw error;
    }
  }
}

export async function clearAuthorPending(partyId: string, ownerId: string, through: string) {
  try {
    await db.send(new DeleteCommand({ TableName: tableName(), Key: key(`PARTY#${partyId}`, `LEARN_PENDING#${ownerId}`),
      ConditionExpression: 'lastMessageId <= :through', ExpressionAttributeValues: { ':through': through } }));
  } catch (error) { if (!(error instanceof Error) || error.name !== 'ConditionalCheckFailedException') throw error; }
}
