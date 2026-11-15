import { afterEach, describe, expect, it } from 'vitest';
import type { MemoryFact } from '@vibe/shared';
import type { SQSRecord } from 'aws-lambda';
import {
  factDocumentId,
  partyMessageDocumentId,
  partyNamespace,
  privateNamespace,
  sharedNamespace,
} from '../src/memory-provider.js';
import { memoryWorkerInternals } from '../src/memory-worker.js';
import { partyMessageIdFromDocumentId, rehydrateSharedResults } from '../src/memory-context.js';

const priorStage = process.env.APP_STAGE;
const priorMemoryQueueUrl = process.env.MEMORY_QUEUE_URL;

function queueRecord(body: unknown): SQSRecord {
  return { body: JSON.stringify(body) } as SQSRecord;
}

function fact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: 'fact_a1',
    ownerId: 'owner-a',
    text: 'I prefer morning lectures.',
    category: 'schedule',
    version: 2,
    approval: 'approved',
    approvedVersion: 2,
    source: 'conversation',
    sourcePartyId: 'private-source-party',
    sourceMessageIds: ['message-1'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    syncState: 'synced',
    ...overrides,
  };
}

afterEach(() => {
  if (priorStage === undefined) delete process.env.APP_STAGE;
  else process.env.APP_STAGE = priorStage;
  if (priorMemoryQueueUrl === undefined) delete process.env.MEMORY_QUEUE_URL;
  else process.env.MEMORY_QUEUE_URL = priorMemoryQueueUrl;
});

describe('memory provider identity and queue routing', () => {
  it('uses stage-scoped namespaces and immutable fact version IDs', () => {
    process.env.APP_STAGE = 'test';
    expect(partyNamespace('party123')).toBe('vibe-test-party-party123');
    expect(privateNamespace('user_123')).toBe('vibe-test-user-user_123-private');
    expect(sharedNamespace('user_123')).toBe('vibe-test-user-user_123-shared');
    expect(factDocumentId('fact_a1', 2)).toBe('fact_a1-v2');
    expect(partyMessageDocumentId('message_1')).toBe('message-message_1');
    expect(() => factDocumentId('fact', 0)).toThrow();
  });

  it('validates memory sync jobs and rejects malformed or unsupported payloads', () => {
    const parse = memoryWorkerInternals.parseJob;
    expect(parse(queueRecord({ effectId: 'outbox-1', type: 'MEMORY_SYNC', ownerId: 'owner-a', factId: 'fact-a', version: 3 })))
      .toEqual({ effectId: 'outbox-1', type: 'MEMORY_SYNC', ownerId: 'owner-a', factId: 'fact-a', version: 3 });
    expect(parse(queueRecord({ effectId: 'outbox-2', type: 'MEMORY_EXTRACT', partyId: 'p', triggerMessageId: 'm', force: false, expectedRevision: 0 })))
      .toMatchObject({ type: 'MEMORY_EXTRACT', expectedRevision: 0 });
    expect(() => parse(queueRecord({ effectId: 'outbox-3', type: 'MEMORY_SYNC', ownerId: 'u', factId: 'f', version: 0 }))).toThrow();
    expect(() => parse(queueRecord({ effectId: 'outbox-4', type: 'OTHER' }))).toThrow();
  });

  it('shortens visibility for an in-flight memory retry', () => {
    process.env.MEMORY_QUEUE_URL = 'https://sqs.us-east-2.amazonaws.com/123456789012/vibe-dev-memory.fifo';
    expect(memoryWorkerInternals.retryVisibilityInput({ receiptHandle: 'receipt-1' } as SQSRecord)).toEqual({
      QueueUrl: process.env.MEMORY_QUEUE_URL,
      ReceiptHandle: 'receipt-1',
      VisibilityTimeout: 10,
    });
  });
});

describe('canonical memory result validation', () => {
  it('maps provider aliases to the current canonical approved owner fact', () => {
    const approved = fact();
    const results = rehydrateSharedResults([
      {
        isLatest: true,
        included: { document: { id: 'provider-internal-document-id', metadata: { factId: approved.id, version: 2, ownerId: approved.ownerId } } },
      },
    ], [approved]);
    expect(results).toEqual([approved]);
  });

  it('rejects stale, private, deleted, expired, and wrong-owner search results', () => {
    const current = fact();
    const expired = fact({ id: 'expired', expiresAt: '2020-01-01T00:00:00.000Z' });
    const providerResult = (factId: string, version: number, ownerId = 'owner-a') => ({
      isLatest: true,
      included: { document: { id: 'opaque', metadata: { factId, version, ownerId } } },
    });
    expect(rehydrateSharedResults([
      providerResult(current.id, 1),
      providerResult('private', 1),
      providerResult('deleted', 1),
      providerResult(expired.id, expired.version),
      providerResult(current.id, current.version, 'owner-b'),
    ], [
      current,
      fact({ id: 'private', approval: 'private', approvedVersion: undefined }),
      fact({ id: 'deleted', deleted: true }),
      expired,
    ])).toEqual([]);
  });

  it('rejects the whole extracted fact when any source ID is outside canonical input', () => {
    const parse = memoryWorkerInternals.parseExtractedFacts;
    const raw = JSON.stringify({ facts: [
      { text: 'I prefer mornings.', category: 'schedule', sourceMessageIds: ['mine', 'someone-else'] },
      { text: 'I am vegetarian.', category: 'dietary', sourceMessageIds: ['mine'] },
    ] });
    expect(parse(raw, new Set(['mine']))).toEqual([
      { text: 'I am vegetarian.', category: 'dietary', sourceMessageIds: ['mine'] },
    ]);
  });

  it('accepts only well-formed party message IDs', () => {
    expect(partyMessageIdFromDocumentId('message-01HABC')).toBe('01HABC');
    expect(partyMessageIdFromDocumentId('provider-alias')).toBeUndefined();
  });
});
