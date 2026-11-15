import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryFact } from '@vibe/shared';

const state = vi.hoisted(() => ({
  profile: { memoryRevision: 1, learningEnabled: true },
  message: { authorId: 'owner', role: 'user', memoryRevisionAtCreation: 0 },
  existingFact: undefined as Record<string, unknown> | undefined,
  tombstone: undefined as Record<string, unknown> | undefined,
}));

const storeMocks = vi.hoisted(() => ({
  db: { send: vi.fn() },
  getItem: vi.fn(),
  key: (PK: string, SK: string) => ({ PK, SK }),
  makeOutboxItem: vi.fn(() => ({ PK: 'OUTBOX#sync', SK: 'META' })),
  membershipCheck: vi.fn((partyId: string, userId: string) => ({
    ConditionCheck: { Key: { PK: `PARTY#${partyId}`, SK: `MEMBER#${userId}` } },
  })),
  tableName: () => 'vibe-test',
  toMember: vi.fn(),
  transact: vi.fn(),
}));

vi.mock('../src/store.js', () => storeMocks);

import { createExtractedCandidate, ownerRevisionUpdate, sourceTombstoneItems } from '../src/memory-store.js';

function candidateInput(expectedRevision = 1) {
  return {
    text: 'I prefer morning classes.',
    category: 'schedule',
    sourcePartyId: 'party',
    sourceMessageIds: ['message-1'],
    sourceRevision: 0,
    expectedRevision,
  };
}

describe('canonical memory extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.profile = { memoryRevision: 1, learningEnabled: true };
    state.message = { authorId: 'owner', role: 'user', memoryRevisionAtCreation: 0 };
    state.existingFact = undefined;
    state.tombstone = undefined;
    storeMocks.getItem.mockImplementation(async (PK: string, SK: string) => {
      if (PK === 'USER#owner' && SK === 'PROFILE') return state.profile;
      if (PK === 'PARTY#party' && SK === 'MEMBER#owner') return { userId: 'owner' };
      if (PK === 'PARTY#party' && SK === 'MSG#message-1') return state.message;
      if (PK === 'USER#owner' && SK.startsWith('PREF#')) return state.existingFact;
      if (PK === 'USER#owner' && SK.startsWith('SUPPRESS#')) return state.tombstone;
      return undefined;
    });
    storeMocks.transact.mockResolvedValue(undefined);
  });

  it('allows later candidates from one source revision to commit with a newer CAS revision', async () => {
    const result = await createExtractedCandidate('owner', candidateInput(1));
    const actions = storeMocks.transact.mock.calls[0]?.[0] as Array<Record<string, any>>;
    const profileUpdate = actions.find((action) => 'Update' in action)?.Update;

    expect(result.status).toBe('created');
    expect(result.memoryRevision).toBe(2);
    expect(profileUpdate?.ExpressionAttributeValues[':expected']).toBe(1);
    expect(profileUpdate?.ConditionExpression).toContain('#learning = :enabled');
    expect(actions.some((action) => action.ConditionCheck?.Key?.SK === 'MEMBER#owner')).toBe(true);
  });

  it('lets manual memory edits CAS the revision while automatic learning is off', () => {
    const update = ownerRevisionUpdate('owner', '2026-02-01T00:00:00.000Z', 4).Update;

    expect(update.ConditionExpression).toBe('attribute_exists(PK) AND #revision = :expected');
    expect(update.ExpressionAttributeNames).not.toHaveProperty('#learning');
    expect(update.ExpressionAttributeValues[':expected']).toBe(4);
  });

  it('rejects sources whose creation revision differs from the extraction baseline', async () => {
    state.message = { ...state.message, memoryRevisionAtCreation: 2 };

    const result = await createExtractedCandidate('owner', candidateInput(1));

    expect(result.status).toBe('source-invalid');
    expect(storeMocks.transact).not.toHaveBeenCalled();
  });

  it('rejects source messages authored by another member', async () => {
    state.message = { ...state.message, authorId: 'someone-else' };

    const result = await createExtractedCandidate('owner', candidateInput());

    expect(result.status).toBe('source-invalid');
    expect(storeMocks.transact).not.toHaveBeenCalled();
  });

  it('returns the live revision when a stale extraction loses the revision CAS', async () => {
    state.profile = { memoryRevision: 2, learningEnabled: true };

    const result = await createExtractedCandidate('owner', candidateInput(1));

    expect(result.status).toBe('revision-conflict');
    expect(result.memoryRevision).toBe(2);
    expect(storeMocks.transact).not.toHaveBeenCalled();
  });

  it('uses a source-wide tombstone key so paraphrased candidates stay suppressed', () => {
    const base: MemoryFact = {
      id: 'fact-a', ownerId: 'owner', text: 'I prefer mornings.', category: 'schedule', version: 1,
      approval: 'candidate', source: 'conversation', sourcePartyId: 'party', sourceMessageIds: ['message-1'],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', syncState: 'pending',
    };
    const first = sourceTombstoneItems('owner', base, '2026-01-02T00:00:00.000Z')[0];
    const second = sourceTombstoneItems('owner', { ...base, id: 'fact-b', text: 'Mornings work best for me.' }, '2026-01-03T00:00:00.000Z')[0];

    expect(first?.SK).toBe(second?.SK);
  });
});

