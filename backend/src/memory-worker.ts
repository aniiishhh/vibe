import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { ChangeMessageVisibilityCommand, SQSClient } from '@aws-sdk/client-sqs';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Handler, SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { z } from 'zod';
import {
  createExtractedCandidate,
  getOwnerFact,
  getOwnerRevision,
  isFactReusable,
} from './memory-store.js';
import {
  deleteMemoryDocuments,
  factDocumentId,
  partyMessageDocumentId,
  partyNamespace,
  privateNamespace,
  putMemoryDocument,
  sharedNamespace,
} from './memory-provider.js';
import { db, getItem, key, makeOutboxItem, tableName, transact, type Item } from './store.js';

type MemoryJob =
  | { effectId: string; type: 'MEMORY_SYNC'; ownerId: string; factId: string; version: number }
  | { effectId: string; type: 'MEMORY_EXTRACT'; partyId: string; triggerMessageId: string; force: boolean; expectedRevision: number }
  | { effectId: string; type: 'PARTY_SYNC'; partyId: string; messageId: string };

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? 'us-east-2',
  maxAttempts: 2,
  retryMode: 'adaptive',
});
const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 2 });
const RETRY_VISIBILITY_SECONDS = 10;

const extractedFactSchema = z.object({
  facts: z.array(z.object({
    text: z.string().trim().min(1).max(500),
    category: z.enum(['preference', 'academics', 'travel', 'schedule', 'communication', 'dietary', 'accessibility', 'general']),
    sourceMessageIds: z.array(z.string().min(1).max(80)).min(1).max(20),
  }).strict()).max(5),
}).strict();

const firstPerson = /\b(?:i|i'm|i am|i've|i have|i'd|i prefer|i like|i love|i need|my|me)\b/i;

function parseJob(record: SQSRecord): MemoryJob {
  const value = JSON.parse(record.body) as Record<string, unknown>;
  if (typeof value.effectId !== 'string' || !value.effectId) throw new Error('Invalid memory queue message');
  if (value.type === 'MEMORY_SYNC') {
    if (typeof value.ownerId !== 'string' || !value.ownerId || typeof value.factId !== 'string' || !value.factId ||
        !Number.isSafeInteger(value.version) || Number(value.version) < 1) throw new Error('Invalid memory sync message');
    return value as MemoryJob;
  }
  if (value.type === 'MEMORY_EXTRACT') {
    if (typeof value.partyId !== 'string' || !value.partyId || typeof value.triggerMessageId !== 'string' ||
        !value.triggerMessageId || typeof value.force !== 'boolean' ||
        !Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 0) {
      throw new Error('Invalid memory extraction message');
    }
    return value as MemoryJob;
  }
  if (value.type === 'PARTY_SYNC') {
    if (typeof value.partyId !== 'string' || !value.partyId || typeof value.messageId !== 'string' || !value.messageId) {
      throw new Error('Invalid party sync message');
    }
    return value as MemoryJob;
  }
  throw new Error('Unknown memory queue message type');
}

function textFromModel(response: ConverseCommandOutput): string {
  return response.output?.message?.content
    ?.flatMap((block) => typeof block.text === 'string' ? [block.text] : [])
    .join('')
    .trim() ?? '';
}

function parseExtractedFacts(raw: string, allowedMessageIds: Set<string>) {
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const result = extractedFactSchema.parse(JSON.parse(json));
  return result.facts.filter((fact) => fact.sourceMessageIds.every((id) => allowedMessageIds.has(id)))
    .map((fact) => ({ ...fact, sourceMessageIds: [...new Set(fact.sourceMessageIds)] }));
}

function isDurableSelfStatement(text: string): boolean {
  return firstPerson.test(text) && text.length > 0;
}

async function extractFacts(messages: Item[]): Promise<ReturnType<typeof parseExtractedFacts>> {
  const selected = messages.filter((message) => isDurableSelfStatement(String(message.text ?? '')));
  if (!selected.length) return [];
  const allowedIds = new Set(selected.map((message) => String(message.id)));
  const prompt = selected.map((message) =>
    JSON.stringify({ messageId: String(message.id), text: String(message.text).slice(0, 2_000) }),
  ).join('\n');
  const modelId = process.env.MODEL_ID || 'deepseek.v3.2';
  const deadlineAt = Date.now() + 60_000;
  let validationError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error('Memory extraction exceeded its time limit');
    const response = await bedrock.send(new ConverseCommand({
      modelId,
      system: [{ text: [
        'Extract only explicit, durable facts that the author states about themselves in the supplied messages.',
        'Do not infer facts from plans, questions, temporary circumstances, or claims about another person.',
        'Ignore quoted text and statements about friends, classmates, family, or the group.',
        'Use only message IDs from the input as sourceMessageIds. Return at most 5 concise facts, at most 500 characters each.',
        'Return strict JSON only with shape {"facts":[{"text":"...","category":"preference|academics|travel|schedule|communication|dietary|accessibility|general","sourceMessageIds":["..."]}]}.',
        ...(attempt === 0 ? [] : ['The previous response was invalid. Return valid JSON with every sourceMessageId copied exactly from the provided messages.']),
      ].join(' ') }],
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1_024, temperature: 0 },
    }), { abortSignal: AbortSignal.timeout(Math.min(30_000, remainingMs)) });
    try {
      return parseExtractedFacts(textFromModel(response), allowedIds);
    } catch (error) {
      validationError = error;
    }
  }
  throw new Error(validationError instanceof Error ? 'Memory extraction returned invalid structured output.' : 'Memory extraction failed validation.');
}

async function setSyncState(
  ownerId: string,
  factId: string,
  version: number,
  state: 'processing' | 'synced' | 'error' | 'deleting',
  message?: string,
): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: tableName(),
    Key: key(`USER#${ownerId}`, `PREF#${factId}`),
    UpdateExpression: message
      ? 'SET syncState = :state, syncError = :error, updatedAt = :now'
      : 'SET syncState = :state, updatedAt = :now REMOVE syncError',
    ConditionExpression: 'entityType = :entity AND #version = :version',
    ExpressionAttributeNames: { '#version': 'version' },
    ExpressionAttributeValues: {
      ':entity': 'MEMORY_FACT',
      ':version': version,
      ':state': state,
      ':now': new Date().toISOString(),
      ...(message ? { ':error': message.slice(0, 120) } : {}),
    },
  }));
}

async function deleteVersionRange(namespace: string, factId: string, firstVersion: number, lastVersion: number): Promise<void> {
  for (let start = firstVersion; start <= lastVersion; start += 100) {
    const ids = Array.from({ length: Math.min(100, lastVersion - start + 1) }, (_, index) =>
      factDocumentId(factId, start + index),
    );
    const pending = await deleteMemoryDocuments(namespace, ids);
    if (pending.length) throw new Error(`Supermemory cleanup remains pending for ${pending.length} documents`);
  }
}

async function deleteTrackedVersionRange(
  ownerId: string,
  factId: string,
  version: number,
  namespace: string,
  cursorAttribute: 'privateCleanupThrough' | 'sharedCleanupThrough',
  lastVersion: number,
): Promise<void> {
  if (lastVersion < 1) return;
  const maximumBatches = 3;
  let batches = 0;
  while (true) {
    const current = await getItem(`USER#${ownerId}`, `PREF#${factId}`);
    if (!current || Number(current.version) !== version) throw new Error('Memory fact advanced during provider cleanup');
    const cursor = Number(current.providerCleanupVersion) === version
      ? Number(current[cursorAttribute] ?? 0)
      : 0;
    if (cursor >= lastVersion) return;
    const start = cursor + 1;
    const end = Math.min(lastVersion, start + 99);
    const ids = Array.from({ length: end - start + 1 }, (_, index) => factDocumentId(factId, start + index));
    const pending = await deleteMemoryDocuments(namespace, ids);
    if (pending.length) throw new Error(`Supermemory cleanup remains pending for ${pending.length} documents`);
    await db.send(new UpdateCommand({
      TableName: tableName(),
      Key: key(`USER#${ownerId}`, `PREF#${factId}`),
      UpdateExpression: 'SET providerCleanupVersion = :version, #cursor = :through',
      ConditionExpression: 'entityType = :entity AND #version = :version',
      ExpressionAttributeNames: { '#cursor': cursorAttribute, '#version': 'version' },
      ExpressionAttributeValues: { ':entity': 'MEMORY_FACT', ':version': version, ':through': end },
    }));
    batches += 1;
    if (batches >= maximumBatches && end < lastVersion) {
      throw new Error('Supermemory cleanup will continue from its saved cursor');
    }
  }
}

async function syncFact(job: Extract<MemoryJob, { type: 'MEMORY_SYNC' }>): Promise<void> {
  const fact = await getOwnerFact(job.ownerId, job.factId, { includeDeleted: true });
  if (!fact) return;
  const privateNs = privateNamespace(job.ownerId);
  const sharedNs = sharedNamespace(job.ownerId);
  const requestedVersionId = factDocumentId(job.factId, job.version);

  // A late queue delivery can never replace the current provider version.
  if (fact.version !== job.version) {
    const pending = await Promise.all([
      deleteMemoryDocuments(privateNs, [requestedVersionId]),
      deleteMemoryDocuments(sharedNs, [requestedVersionId]),
    ]);
    if (pending.some((ids) => ids.length)) throw new Error('Stale memory document cleanup is still pending');
    return;
  }

  const reusable = isFactReusable(fact);
  const active = !fact.deleted && (!fact.expiresAt || Date.parse(fact.expiresAt) > Date.now());
  await setSyncState(job.ownerId, job.factId, job.version, 'processing');
  try {
    if (active) {
      await Promise.all([
        putMemoryDocument({
          namespace: privateNs,
          id: factDocumentId(fact.id, fact.version),
          content: fact.text.slice(0, 500),
          taskType: 'memory',
          metadata: {
            entityType: 'personal_fact',
            factId: fact.id,
            version: fact.version,
            ownerId: fact.ownerId,
            approval: fact.approval,
            ...(fact.sourcePartyId ? { sourcePartyId: fact.sourcePartyId } : {}),
          },
          supportingContext: 'A canonical personal memory fact. Use only the explicitly stated content.',
        }),
        reusable
          ? putMemoryDocument({
              namespace: sharedNs,
              id: factDocumentId(fact.id, fact.version),
              content: fact.text.slice(0, 500),
              taskType: 'memory',
              metadata: { entityType: 'shared_personal_fact', factId: fact.id, version: fact.version, ownerId: fact.ownerId },
              supportingContext: 'An owner-approved reusable personal fact. Do not infer its private source.',
            })
          : Promise.resolve(),
        deleteTrackedVersionRange(job.ownerId, fact.id, fact.version, privateNs, 'privateCleanupThrough', fact.version - 1),
        deleteTrackedVersionRange(job.ownerId, fact.id, fact.version, sharedNs, 'sharedCleanupThrough', reusable ? fact.version - 1 : fact.version),
      ]);
    } else {
      await Promise.all([
        deleteTrackedVersionRange(job.ownerId, fact.id, fact.version, privateNs, 'privateCleanupThrough', fact.version),
        deleteTrackedVersionRange(job.ownerId, fact.id, fact.version, sharedNs, 'sharedCleanupThrough', fact.version),
      ]);
    }
    await setSyncState(job.ownerId, job.factId, job.version, 'synced');
  } catch (error) {
    const cleanupPending = error instanceof Error && /cleanup|delete/i.test(error.message);
    try {
      await setSyncState(job.ownerId, job.factId, job.version, cleanupPending ? 'deleting' : 'error',
        error instanceof Error ? error.name : 'ProviderError');
    } catch {
      // The fact may have advanced while this stale sync was running.
    }
    throw error;
  }
}

async function syncPartyMessage(job: Extract<MemoryJob, { type: 'PARTY_SYNC' }>): Promise<void> {
  const message = await getItem(`PARTY#${job.partyId}`, `MSG#${job.messageId}`);
  if (!message || message.partyId !== job.partyId || typeof message.text !== 'string') return;
  const author = message.role === 'assistant' ? 'Vibe' : String(message.authorName ?? 'Party member');
  await putMemoryDocument({
    namespace: partyNamespace(job.partyId),
    id: partyMessageDocumentId(job.messageId),
    content: `${author} (${message.role === 'assistant' ? 'assistant' : 'member'}): ${message.text.slice(0, 4_000)}`,
    taskType: 'superrag',
    metadata: {
      entityType: 'party_message',
      partyId: job.partyId,
      messageId: job.messageId,
      role: message.role === 'assistant' ? 'assistant' : 'user',
    },
  });
}

async function loadMessagesSinceCursor(
  partyId: string,
  ownerId: string,
  triggerMessageId: string,
  expectedRevision: number,
): Promise<{ messages: Item[]; skippedThroughId?: string }> {
  const cursor = await getItem(`PARTY#${partyId}`, `MEMORY_EXTRACT#${ownerId}`);
  const start = typeof cursor?.lastMessageId === 'string' ? cursor.lastMessageId : '';
  if (start && start >= triggerMessageId) return { messages: [] };
  const items: Item[] = [];
  let lastKey: Item | undefined;
  let skippedThroughId: string | undefined;
  do {
    const response = await db.send(new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :party AND SK BETWEEN :from AND :through',
      ExpressionAttributeValues: {
        ':party': `PARTY#${partyId}`,
        ':from': start ? `MSG#${start}` : 'MSG#',
        ':through': `MSG#${triggerMessageId}`,
      },
      ConsistentRead: true,
      ScanIndexForward: true,
      Limit: 100,
      ExclusiveStartKey: lastKey,
    }));
    for (const item of response.Items ?? []) {
      const id = String(item.id ?? String(item.SK).slice('MSG#'.length));
      if (id <= start || id > triggerMessageId) continue;
      if (item.authorId !== ownerId || item.role !== 'user') continue;
      const stampedRevision = item.memoryRevisionAtCreation;
      const sameRevision = stampedRevision === expectedRevision || (stampedRevision === undefined && expectedRevision === 0);
      if (!sameRevision) {
        skippedThroughId = id;
        continue;
      }
      items.push({ ...item, id });
    }
    lastKey = response.LastEvaluatedKey;
    if (items.length >= 20) break;
  } while (lastKey);
  return { messages: items, ...(skippedThroughId ? { skippedThroughId } : {}) };
}

async function setExtractionCursor(partyId: string, ownerId: string, messageId: string): Promise<void> {
  const cursorKey = key(`PARTY#${partyId}`, `MEMORY_EXTRACT#${ownerId}`);
  const existing = await getItem(String(cursorKey.PK), String(cursorKey.SK));
  if (typeof existing?.lastMessageId === 'string' && existing.lastMessageId >= messageId) return;
  try {
    await db.send(new UpdateCommand({
      TableName: tableName(),
      Key: cursorKey,
      UpdateExpression: 'SET entityType = :entity, ownerId = :owner, lastMessageId = :message, updatedAt = :now',
      ConditionExpression: 'attribute_not_exists(lastMessageId) OR lastMessageId < :message',
      ExpressionAttributeValues: {
        ':entity': 'MEMORY_EXTRACTION_CURSOR',
        ':owner': ownerId,
        ':message': messageId,
        ':now': new Date().toISOString(),
      },
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return;
    throw error;
  }
}

async function extractForMessage(
  job: Extract<MemoryJob, { type: 'MEMORY_EXTRACT' }>,
): Promise<void> {
  const trigger = await getItem(`PARTY#${job.partyId}`, `MSG#${job.triggerMessageId}`);
  if (!trigger || trigger.role !== 'user' || typeof trigger.authorId !== 'string' ||
      trigger.partyId !== job.partyId || trigger.id !== job.triggerMessageId) return;
  const ownerId = trigger.authorId;
  const profile = await getItem(`USER#${ownerId}`, 'PROFILE');
  if (process.env.METERED_FEATURES_ENABLED !== 'true' || profile?.learningEnabled !== true) {
    await setExtractionCursor(job.partyId, ownerId, job.triggerMessageId);
    return;
  }
  if (!await getItem(`PARTY#${job.partyId}`, `MEMBER#${ownerId}`)) {
    await setExtractionCursor(job.partyId, ownerId, job.triggerMessageId);
    return;
  }

  const currentRevision = await getOwnerRevision(ownerId);
  // A queued job must not reinterpret messages written before an owner correction.
  if (currentRevision !== job.expectedRevision) {
    await setExtractionCursor(job.partyId, ownerId, job.triggerMessageId);
    return;
  }

  const loaded = await loadMessagesSinceCursor(job.partyId, ownerId, job.triggerMessageId, job.expectedRevision);
  const pending = loaded.messages;
  if (!job.force && pending.length < 10) {
    if (loaded.skippedThroughId) await setExtractionCursor(job.partyId, ownerId, loaded.skippedThroughId);
    return;
  }
  const batch = pending.slice(0, 20);
  if (!batch.length) {
    if (job.force) await setExtractionCursor(job.partyId, ownerId, job.triggerMessageId);
    else if (loaded.skippedThroughId) await setExtractionCursor(job.partyId, ownerId, loaded.skippedThroughId);
    return;
  }

  const facts = await extractFacts(batch);
  const allowedIds = new Set(batch.filter((message) => isDurableSelfStatement(String(message.text ?? '')))
    .map((message) => String(message.id)));
  let expectedRevision = job.expectedRevision;
  for (const fact of facts) {
    const sourceMessageIds = fact.sourceMessageIds.filter((id) => allowedIds.has(id));
    if (!sourceMessageIds.length) continue;
    const result = await createExtractedCandidate(ownerId, {
      text: fact.text,
      category: fact.category,
      sourcePartyId: job.partyId,
      sourceMessageIds,
      expectedRevision,
      sourceRevision: job.expectedRevision,
    });
    if (result.status === 'created') expectedRevision += 1;
    if (result.status === 'revision-conflict') {
      await setExtractionCursor(job.partyId, ownerId, job.triggerMessageId);
      return;
    }
  }
  if (await getOwnerRevision(ownerId) !== expectedRevision) {
    // Retry will observe the newer revision and suppress this pre-correction batch.
    throw new Error('Owner memory revision changed during extraction');
  }
  await setExtractionCursor(job.partyId, ownerId, String(batch.at(-1)!.id));
}

async function processJob(job: MemoryJob): Promise<void> {
  if (job.type === 'MEMORY_SYNC') return syncFact(job);
  if (job.type === 'MEMORY_EXTRACT') return extractForMessage(job);
  if (job.type === 'PARTY_SYNC') return syncPartyMessage(job);
}

async function processRecord(record: SQSRecord): Promise<void> {
  let job: MemoryJob;
  try {
    job = parseJob(record);
  } catch (error) {
    console.error(JSON.stringify({ type: 'invalid_memory_queue_message', messageId: record.messageId }));
    return;
  }
  try {
    await processJob(job);
  } catch (error) {
    if (job.type === 'MEMORY_SYNC' && Number(record.attributes.ApproximateReceiveCount ?? 1) >= 4) {
      await scheduleMemorySyncRetry(job);
      console.error(JSON.stringify({ type: 'memory_cleanup_retry_scheduled', effectId: job.effectId, jobType: job.type }));
      return;
    }
    console.error(JSON.stringify({ type: 'memory_job_retry', messageId: record.messageId, jobType: job.type,
      errorName: error instanceof Error ? error.name : 'MemoryError' }));
    throw error;
  }
}

async function scheduleMemorySyncRetry(job: Extract<MemoryJob, { type: 'MEMORY_SYNC' }>): Promise<void> {
  const item = makeOutboxItem('MEMORY_SYNC', job.ownerId, {
    ownerId: job.ownerId,
    factId: job.factId,
    version: job.version,
  });
  const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
  item.dueAt = retryAt;
  item.GSI2SK = `${retryAt}#${String(item.effectId)}`;
  await transact([{
    Put: {
      TableName: tableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    },
  }]);
}

function retryVisibilityInput(record: Pick<SQSRecord, 'receiptHandle'>): {
  QueueUrl: string;
  ReceiptHandle: string;
  VisibilityTimeout: number;
} | undefined {
  const queueUrl = process.env.MEMORY_QUEUE_URL;
  if (!queueUrl || !record.receiptHandle) return undefined;
  return {
    QueueUrl: queueUrl,
    ReceiptHandle: record.receiptHandle,
    VisibilityTimeout: RETRY_VISIBILITY_SECONDS,
  };
}

async function releaseFailedRecordForQuickRetry(record: SQSRecord): Promise<void> {
  const input = retryVisibilityInput(record);
  if (!input) {
    console.error(JSON.stringify({ type: 'memory_retry_visibility_unavailable', messageId: record.messageId }));
    return;
  }
  try {
    await sqs.send(new ChangeMessageVisibilityCommand(input));
  } catch (error) {
    console.error(JSON.stringify({
      type: 'memory_retry_visibility_failed',
      messageId: record.messageId,
      errorName: error instanceof Error ? error.name : 'SqsError',
    }));
  }
}

export const handler: Handler<SQSEvent, SQSBatchResponse> = async (event) => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch {
      await releaseFailedRecordForQuickRetry(record);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};

export const memoryWorkerInternals = {
  parseJob,
  parseExtractedFacts,
  isDurableSelfStatement,
  deleteVersionRange,
  deleteTrackedVersionRange,
  setExtractionCursor,
  retryVisibilityInput,
};

