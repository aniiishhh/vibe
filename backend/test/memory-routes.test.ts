import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryFact } from '@vibe/shared';

const storeMocks = vi.hoisted(() => ({
  AppError: class AppError extends Error {
    constructor(readonly statusCode: number, readonly code: string, message: string, readonly retryable = false) {
      super(message);
    }
  },
  db: { send: vi.fn() },
  getItem: vi.fn(),
  getOrCreateProfile: vi.fn(),
  key: (PK: string, SK: string) => ({ PK, SK }),
  partyMembershipRevisionUpdate: vi.fn((partyId: string, expectedRevision: number) => ({
    Update: { Key: { PK: `PARTY#${partyId}`, SK: 'META' }, expectedRevision },
  })),
  requireParty: vi.fn(),
  tableName: () => 'vibe-test',
  toMember: vi.fn((item: Record<string, unknown>) => ({
    userId: String(item.userId),
    useSharedMemory: item.useSharedMemory === true,
  })),
}));

const memoryMocks = vi.hoisted(() => ({
  getOwnerFact: vi.fn(),
  getOwnerRevision: vi.fn(),
  isFactReusable: vi.fn(),
  listOwnerFacts: vi.fn(),
  listPartyFacts: vi.fn(),
  memoryFactKey: vi.fn((ownerId: string, factId: string) => ({ PK: `USER#${ownerId}`, SK: `PREF#${factId}` })),
  memorySyncOutbox: vi.fn(() => ({ PK: 'OUTBOX#sync', SK: 'META' })),
  ownerRevisionUpdate: vi.fn(() => ({ Update: { Key: { PK: 'USER#owner', SK: 'PROFILE' } } })),
  sourceTombstoneItems: vi.fn(() => [{ PK: 'USER#owner', SK: 'SUPPRESS#source' }]),
  toMemoryFact: vi.fn(),
}));

vi.mock('../src/store.js', () => storeMocks);
vi.mock('../src/memory-store.js', () => memoryMocks);

import { deleteMemory, updateMemory, updatePartyMemorySharing } from '../src/memory-routes.js';

function event(body: unknown) {
  return { body: JSON.stringify(body), isBase64Encoded: false } as never;
}

const originalFact: MemoryFact = {
  id: 'fact-1', ownerId: 'owner', text: 'I prefer morning classes.', category: 'schedule', version: 1,
  approval: 'approved', approvedVersion: 1, source: 'conversation', sourcePartyId: 'party', sourceMessageIds: ['message-1'],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', syncState: 'synced',
};

describe('memory mutation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryMocks.getOwnerFact.mockResolvedValue({ ...originalFact });
    memoryMocks.getOwnerRevision.mockResolvedValue(4);
    memoryMocks.sourceTombstoneItems.mockReturnValue([{ PK: 'USER#owner', SK: 'SUPPRESS#source' }]);
    storeMocks.getOrCreateProfile.mockResolvedValue({ id: 'owner', memoryRevision: 4, learningEnabled: true });
    storeMocks.requireParty.mockResolvedValue({ id: 'party' });
    storeMocks.getItem.mockImplementation(async (PK: string, SK: string) => {
      if (PK === 'PARTY#party' && SK === 'MEMBER#owner') return { userId: 'owner', name: 'Owner', joinedAt: '2026-01-01', role: 'owner', useSharedMemory: false };
      if (PK === 'PARTY#party' && SK === 'META') return { membershipRevision: 4 };
      return undefined;
    });
    storeMocks.db.send.mockResolvedValue({});
  });

  it('invalidates approval, increments version, and writes source tombstones after a correction', async () => {
    const updated = await updateMemory({ sub: 'owner' }, 'fact-1', event({ version: 1, text: 'I prefer afternoon classes.' }));
    const transaction = storeMocks.db.send.mock.calls[0]?.[0]?.input.TransactItems as Array<Record<string, any>>;
    const factWrite = transaction.find((action) => action.Put?.Item?.entityType === 'MEMORY_FACT')?.Put;

    expect(updated.version).toBe(2);
    expect(updated.text).toBe('I prefer afternoon classes.');
    expect(updated.approval).toBe('private');
    expect(updated.approvedVersion).toBeUndefined();
    expect(factWrite.Item.approval).toBe('private');
    expect(factWrite.ConditionExpression).toContain('#version = :version');
    expect(transaction.some((action) => action.Put?.Item?.SK === 'SUPPRESS#source')).toBe(true);
  });

  it('deletes a conversation fact with a tombstone and provider cleanup outbox', async () => {
    const deleted = await deleteMemory({ sub: 'owner' }, 'fact-1', event({ version: 1 }));
    const transaction = storeMocks.db.send.mock.calls[0]?.[0]?.input.TransactItems as Array<Record<string, any>>;

    expect(deleted.deleted).toBe(true);
    expect(deleted.version).toBe(2);
    expect(deleted.approval).toBe('private');
    expect(deleted.syncState).toBe('deleting');
    expect(transaction.some((action) => action.Put?.Item?.SK === 'SUPPRESS#source')).toBe(true);
    expect(transaction.some((action) => action.Put?.Item?.PK === 'OUTBOX#sync')).toBe(true);
  });

  it('bumps party membership revision atomically when a member opts in', async () => {
    const member = await updatePartyMemorySharing('party', { sub: 'owner' }, event({ useSharedMemory: true }));
    const transaction = storeMocks.db.send.mock.calls[0]?.[0]?.input.TransactItems as Array<Record<string, any>>;

    expect(member.useSharedMemory).toBe(true);
    expect(transaction).toHaveLength(2);
    expect(transaction.some((action) => action.Update?.Key?.SK === 'MEMBER#owner')).toBe(true);
    expect(transaction.some((action) => action.Update?.Key?.SK === 'META' && action.Update?.expectedRevision === 4)).toBe(true);
  });
});

