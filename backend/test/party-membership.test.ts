import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getItem: vi.fn(), queryItems: vi.fn(), transact: vi.fn(), requireParty: vi.fn() }));
vi.mock('../src/store.js', async () => ({ ...await vi.importActual('../src/store.js'), ...mocks }));
import { archiveParty, changeMember } from '../src/party-membership.js';
import { createPartyNote, changePartyNote } from '../src/party-notes.js';
const rows = new Map<string, Record<string, unknown>>();
const put = (sk: string, fields: Record<string, unknown>) => rows.set(sk, { PK: 'PARTY#p', SK: sk, ...fields });
const actions = () => mocks.transact.mock.calls[0][0] as Array<any>;
beforeEach(() => {
  vi.stubEnv('TABLE_NAME', 'test');
  vi.clearAllMocks(); rows.clear();
  put('META', { ownerId: 'a', membershipRevision: 3 });
  for (const [userId, role] of [['a', 'owner'], ['b', 'admin'], ['c', 'member']]) {
    put(`MEMBER#${userId}`, { userId, role, name: userId, joinedAt: '2026-11-15' });
  }
  mocks.getItem.mockImplementation(async (_pk, sk) => rows.get(sk));
  mocks.queryItems.mockImplementation(async () => ({ items: [...rows.values()].filter(row => String(row.SK).startsWith('MEMBER#')) }));
  mocks.requireParty.mockResolvedValue({ id: 'p' });
  mocks.transact.mockResolvedValue(undefined);
});
describe('party membership and permissions', () => {
  it('lets an admin promote a member with transaction-time admin and revision guards', async () => {
    await changeMember('p', 'b', 'c', 'admin');
    expect(actions().find(action => action.ConditionCheck)?.ConditionCheck).toMatchObject({
      ConditionExpression: expect.stringContaining('#role = :admin'),
    });
    expect(actions().find(action => action.Update?.Key.SK === 'META')?.Update.ExpressionAttributeValues[':expected']).toBe(3);
    expect(actions().find(action => action.Update?.Key.SK === 'MEMBER#c')?.Update.ExpressionAttributeValues[':role']).toBe('admin');
  });
  it('rejects regular members managing others or creating custom notes', async () => {
    await expect(changeMember('p', 'c', 'b')).rejects.toMatchObject({ statusCode: 403 });
    await expect(changeMember('p', 'c', 'c', 'admin')).rejects.toMatchObject({ statusCode: 403 });
    await expect(createPartyNote('p', 'c', { text: 'A custom note', kind: 'suggestion' })).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.transact).not.toHaveBeenCalled();
  });
  it('allows creator exit after another admin is appointed and moves the owner reference', async () => {
    await changeMember('p', 'a', 'a');
    expect(actions().find(action => action.Update?.Key.SK === 'META')?.Update.ExpressionAttributeValues[':owner']).toBe('b');
    expect(actions().filter(action => action.Delete?.Key.SK === 'MEMBER#a')).toHaveLength(1);
    expect(actions().some(action => action.ConditionCheck?.Key.SK === 'MEMBER#a')).toBe(false);
  });
  it('prevents removing the final admin of a populated party, including concurrent conflicts', async () => {
    rows.delete('MEMBER#b');
    await expect(changeMember('p', 'a', 'a')).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    await expect(changeMember('p', 'a', 'a', 'member')).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    mocks.transact.mockRejectedValueOnce(Object.assign(new Error(), { name: 'TransactionCanceledException' }));
    await expect(changeMember('p', 'a', 'c', 'admin')).rejects.toMatchObject({ code: 'MEMBERSHIP_CONFLICT' });
  });
  it('closes an empty party when its sole admin leaves', async () => {
    rows.delete('MEMBER#b'); rows.delete('MEMBER#c');
    await changeMember('p', 'a', 'a');
    expect(actions().find(action => action.Update?.Key.SK === 'META')?.Update.ExpressionAttributeValues[':closed']).toBe(true);
  });
  it('archives and restores only the current user membership without deleting history', async () => {
    expect(await archiveParty('p', 'c', true)).toMatchObject({ archived: true });
    expect(actions()).toHaveLength(1);
    expect(actions()[0].Update).toMatchObject({ Key: { SK: 'MEMBER#c' }, ExpressionAttributeValues: { ':archived': true } });
    expect(await archiveParty('p', 'c', false)).toMatchObject({ archived: false });
  });
  it('allows another admin to manage manual notes but keeps personal corrections subject-owned', async () => {
    put('FACT#n', { entityType: 'PARTY_FACT', id: 'n', partyId: 'p', text: 'A note', kind: 'suggestion', speakerId: 'a', source: 'manual', version: 1, sourceMessageIds: [] });
    await changePartyNote('p', 'b', 'n', { version: 1, text: 'Updated', kind: 'decision' });
    expect(actions()[0].ConditionCheck.ConditionExpression).toContain('#role = :admin');
    rows.get('FACT#n')!.subjectId = 'c';
    await expect(changePartyNote('p', 'b', 'n', { version: 1, text: 'Updated', kind: 'decision' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
