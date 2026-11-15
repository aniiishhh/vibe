import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, any>>(),
  outbox: [] as Record<string, any>[],
}));
const store = vi.hoisted(() => ({
  db: { send: vi.fn() },
  getItem: vi.fn(),
  key: (PK: string, SK: string) => ({ PK, SK }),
  makeOutboxItem: vi.fn((type: string, partyId: string, payload: unknown) => ({ PK: `OUTBOX#${state.outbox.length}`, SK: 'META', type, partyId, payload })),
  membershipCheck: vi.fn(() => ({ ConditionCheck: {} })),
  tableName: () => 'test',
  toMember: vi.fn(),
  transact: vi.fn(),
}));
vi.mock('../src/store.js', () => store);
import { memoryWorkerInternals as worker } from '../src/memory-worker.js';

function put(PK: string, SK: string, fields: Record<string, unknown>): Record<string, any> {
  const row = { PK, SK, ...fields };
  state.rows.set(`${PK}/${SK}`, row);
  return row;
}
function job(extra: Record<string, unknown> = {}) {
  return { effectId: 'effect', type: 'MEMORY_EXTRACT' as const, partyId: 'party', triggerMessageId: '999', force: true, expectedRevision: 0, ...extra };
}
function message(id: string, owner: string, text: string) {
  return put('PARTY#party', `MSG#${id}`, { id, partyId: 'party', authorId: owner, role: 'user', text, memoryRevisionAtCreation: 0 });
}
function response(facts: unknown[]) {
  return { output: { message: { role: 'assistant', content: [{ text: JSON.stringify({ facts }) }] } } } as never;
}
const invoke = vi.spyOn(BedrockRuntimeClient.prototype, 'send');

beforeEach(() => {
  vi.clearAllMocks();
  state.rows.clear();
  state.outbox = [];
  process.env.METERED_FEATURES_ENABLED = 'true';
  for (const owner of ['a', 'b']) {
    put(`USER#${owner}`, 'PROFILE', { memoryRevision: 0, learningEnabled: true, learningBarrierRevision: 0 });
    put('PARTY#party', `MEMBER#${owner}`, { userId: owner });
  }
  message('999', 'a', '@Vibe help us');
  store.getItem.mockImplementation(async (PK, SK) => state.rows.get(`${PK}/${SK}`));
  store.db.send.mockImplementation(async command => {
    const input = command.input;
    if (input.UpdateExpression) {
      const row = state.rows.get(`${input.Key.PK}/${input.Key.SK}`)!;
      row.extractionState = input.ExpressionAttributeValues[':state'];
      return {};
    }
    const values = input.ExpressionAttributeValues;
    const PK = values[':party'] ?? values[':owner'];
    const prefix = values[':member'] ?? values[':prefix'];
    const after = input.ExclusiveStartKey?.SK ?? '';
    const rows = [...state.rows.values()].filter(row => row.PK === PK && row.SK > after &&
      (prefix ? row.SK.startsWith(prefix) : row.SK >= values[':from'] && row.SK <= values[':through']))
      .sort((a, b) => a.SK.localeCompare(b.SK));
    const items = rows.slice(0, input.Limit ?? rows.length);
    return { Items: items, ...(items.length < rows.length ? { LastEvaluatedKey: { PK, SK: items.at(-1)!.SK } } : {}) };
  });
  store.transact.mockImplementation(async actions => {
    for (const action of actions) {
      if (action.Put) {
        const row = action.Put.Item;
        if (row.type) state.outbox.push(row);
        else state.rows.set(`${row.PK}/${row.SK}`, row);
      }
      if (action.Update) {
        const input = action.Update;
        const values = input.ExpressionAttributeValues;
        const row = state.rows.get(`${input.Key.PK}/${input.Key.SK}`) ?? put(input.Key.PK, input.Key.SK, {});
        if (values[':expected'] !== undefined) {
          row.memoryRevision += 1;
          row.learningBarrierRevision ??= values[':barrier'];
        }
        if (values[':message']) row.lastMessageId = values[':message'];
      }
    }
  });
  invoke.mockResolvedValue(response([]));
});

describe('Milestone 3B bounded personal learning', () => {
  it('fans out a mention across both eligible authors with isolated source windows', async () => {
    message('001', 'a', 'Vegetarian here.');
    message('002', 'b', 'Soy vegetariano. Mujhe subah ki classes pasand hain.');
    await worker.extractForMessage(job({ fanout: true }));
    expect(invoke).not.toHaveBeenCalled();
    const payloads = state.outbox.map(item => item.payload);
    expect(payloads.map(payload => payload.ownerId)).toEqual(['a', 'b']);
    for (const payload of payloads) await worker.extractForMessage(job(payload));
    const calls = invoke.mock.calls.map(call => (call[0] as any).input);
    expect(calls).toHaveLength(2);
    expect(calls[0].messages[0].content[0].text).toContain('Vegetarian here.');
    expect(calls[0].messages[0].content[0].text).not.toContain('Soy vegetariano');
    expect(calls[1].messages[0].content[0].text).toContain('Soy vegetariano');
    expect(calls[1].system[0].text).toContain('Ignore quoted text');
    expect(calls[1].system[0].text).toContain('one-trip budgets');
  });

  it('continues a backlog after candidate creation advances the profile revision', async () => {
    for (let index = 0; index < 25; index += 1) message(String(index).padStart(3, '0'), 'b', `Own statement ${index}`);
    invoke.mockResolvedValueOnce(response([{ text: 'Prefers mornings', category: 'schedule', sourceMessageIds: ['000'] }]));
    await worker.extractForMessage(job({ ownerId: 'b' }));
    expect(state.rows.get('USER#b/PROFILE')?.memoryRevision).toBe(1);
    expect(state.rows.get('PARTY#party/MEMORY_EXTRACT#b')?.lastMessageId).toBe('019');
    const next = state.outbox.find(item => item.type === 'MEMORY_EXTRACT')!.payload;
    expect(next.expectedRevision).toBe(1);
    await worker.extractForMessage(job(next));
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(state.rows.get('PARTY#party/MEMORY_EXTRACT#b')?.lastMessageId).toBe('999');
    expect(state.rows.get('USER#b/PROFILE')?.extractionState).toBe('idle');
    await worker.extractForMessage(job(next));
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('skips disabled and removed authors and suppresses pre-correction jobs', async () => {
    state.rows.get('USER#b/PROFILE')!.learningEnabled = false;
    await worker.extractForMessage(job({ ownerId: 'b' }));
    state.rows.get('USER#b/PROFILE')!.learningEnabled = true;
    state.rows.delete('PARTY#party/MEMBER#b');
    await worker.extractForMessage(job({ ownerId: 'b' }));
    put('PARTY#party', 'MEMBER#b', { userId: 'b' });
    state.rows.get('USER#b/PROFILE')!.learningBarrierRevision = 1;
    await worker.extractForMessage(job({ ownerId: 'b' }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('bounds model input and exposes extraction failures without advancing the cursor', async () => {
    for (let index = 0; index < 20; index += 1) message(String(index).padStart(3, '0'), 'b', 'x'.repeat(2000));
    const loaded = await worker.loadMessagesSinceCursor('party', 'b', '999', 0, 0);
    expect(loaded.messages).toHaveLength(20);
    invoke.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(worker.extractForMessage(job({ ownerId: 'b' }))).rejects.toThrow('provider unavailable');
    const input = (invoke.mock.calls[0][0] as any).input;
    const sources = JSON.parse(input.messages[0].content[0].text).messages;
    expect(sources.split('\n')).toHaveLength(6);
    expect(state.rows.get('USER#b/PROFILE')?.extractionState).toBe('error');
    expect(state.rows.has('PARTY#party/MEMORY_EXTRACT#b')).toBe(false);
  });
  it('continues sparse scanning without lowering the ten-message threshold', async () => {
    message('000', 'b', 'Vegetarian here');
    for (let index = 1; index <= 310; index += 1) message(String(index).padStart(3, '0'), 'a', 'Other discussion');
    message('400', 'b', 'Morning lectures work best');
    await worker.extractForMessage(job({ ownerId: 'b', force: false }));
    const next = state.outbox.find(item => item.type === 'MEMORY_EXTRACT')!.payload;
    expect(next.force).toBe(false);
    expect(next.pendingMessageIds).toEqual(['000']);
    await worker.extractForMessage(job(next));
    expect(invoke).not.toHaveBeenCalled();
    expect(state.rows.has('PARTY#party/MEMORY_EXTRACT#b')).toBe(false);
  });

  it('paginates member fanout and excludes a learning-disabled mention author', async () => {
    state.rows.get('USER#a/PROFILE')!.learningEnabled = false;
    for (let index = 0; index < 12; index += 1) {
      const owner = `user-${index}`;
      put(`USER#${owner}`, 'PROFILE', { learningEnabled: true, memoryRevision: 0 });
      put('PARTY#party', `MEMBER#${owner}`, { userId: owner });
    }
    await worker.extractForMessage(job({ fanout: true }));
    expect(state.outbox.some(item => item.payload.ownerId === 'a')).toBe(false);
    const next = state.outbox.find(item => item.payload.memberAfter)!.payload;
    expect(state.outbox.length).toBeLessThanOrEqual(11);
    await worker.extractForMessage(job(next));
    expect(state.outbox.filter(item => item.payload.ownerId)).toHaveLength(13);
    expect(invoke).not.toHaveBeenCalled();
  });

});
