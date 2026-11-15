import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeMocks = vi.hoisted(() => ({
  db: { send: vi.fn() },
  getItem: vi.fn(),
  transact: vi.fn(),
  key: (PK: string, SK: string) => ({ PK, SK }),
  tableName: () => 'vibe-test',
  membershipCheck: vi.fn((partyId: string, userId: string) => ({
    ConditionCheck: { Key: { PK: `PARTY#${partyId}`, SK: `MEMBER#${userId}` } },
  })),
  refreshOutboxItem: vi.fn(() => ({ PK: 'OUTBOX#change', SK: 'META' })),
  partyMembershipRevisionUpdate: vi.fn((partyId: string, expectedRevision: number) => ({
    Update: { Key: { PK: `PARTY#${partyId}`, SK: 'META' }, expectedRevision },
  })),
  getOrCreateProfile: vi.fn(),
  isTransactionCanceled: vi.fn(() => false),
  forbidden: () => new Error('forbidden'),
  notFound: () => new Error('not found'),
  queryItems: vi.fn(),
  requireParty: vi.fn(),
  toMember: vi.fn(),
  toParty: vi.fn(),
  toProfile: vi.fn(),
  toRun: vi.fn(),
  membershipItem: vi.fn(),
  makeOutboxItem: vi.fn(),
  AppError: class AppError extends Error {
    constructor(readonly statusCode: number, readonly code: string, message: string, readonly retryable = false) {
      super(message);
    }
  },
}));

vi.mock('../src/store.js', () => storeMocks);

import { handler } from '../src/handler.js';

describe('member self-leave transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.getItem.mockImplementation(async (PK: string, SK: string) => {
      if (SK === 'META') return { ownerId: 'party-owner' };
      if (PK === 'PARTY#party' && SK === 'MEMBER#member') return { userId: 'member' };
      return undefined;
    });
    storeMocks.transact.mockResolvedValue(undefined);
  });

  it('uses the conditional member delete instead of checking the same item twice', async () => {
    const event = {
      rawPath: '/api/parties/party/members/member',
      requestContext: {
        requestId: 'request-1',
        http: { method: 'DELETE' },
        authorizer: { jwt: { claims: { sub: 'member' } } },
      },
      isBase64Encoded: false,
    } as never;

    const result = await handler(event, {} as never, () => undefined) as { statusCode?: number } | undefined;
    const actions = storeMocks.transact.mock.calls[0]?.[0] as unknown as Array<Record<string, any>>;

    expect(result?.statusCode).toBe(204);
    expect(actions).toHaveLength(3);
    expect(actions.some((action) => 'ConditionCheck' in action)).toBe(false);
    expect(actions.find((action) => 'Delete' in action)?.Delete?.Key).toEqual({
      PK: 'PARTY#party',
      SK: 'MEMBER#member',
    });
    expect(actions.some((action) => action.Update?.Key?.SK === 'META')).toBe(true);
  });
});
