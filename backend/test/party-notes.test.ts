import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: { send: vi.fn() }, getItem: vi.fn(), transact: vi.fn(), requireParty: vi.fn() }));
vi.mock('../src/store.js', async () => ({ ...await vi.importActual('../src/store.js'), ...mocks }));
import { createPartyNote, changePartyNote, noteId } from '../src/party-notes.js';
import { extractPartyNotes, parsePartyNotes } from '../src/party-note-extraction.js';
import { memoryDependenciesCurrent, memoryDependencyCondition, partyMessageIsCurrent } from '../src/memory-context.js';
const rows = new Map<string, Record<string, unknown>>();
const put = (sk: string, value: Record<string, unknown>) => rows.set(`PARTY#party/${sk}`, { PK: 'PARTY#party', SK: sk, ...value });
const note = { text: 'Meet on Friday', kind: 'decision' as const, sourceMessageIds: ['a', 'b'] };
beforeEach(() => {
    vi.stubEnv('TABLE_NAME', 'test-vibe');
    vi.stubEnv('METERED_FEATURES_ENABLED', 'true');
    vi.clearAllMocks();
    rows.clear();
    put('META', { notesEpoch: 0, notesRevision: 0, ownerId: "alice", membershipRevision: 0 });
    put('MEMBER#alice', { userId: 'alice' });
    put('MEMBER#bob', { userId: 'bob' });
    put('MSG#a', { id: 'a', partyId: 'party', authorId: 'alice', role: 'user', notesEpochAtCreation: 0 });
    put('MSG#b', { id: 'b', partyId: 'party', authorId: 'bob', role: 'user', notesEpochAtCreation: 0 });
    mocks.requireParty.mockResolvedValue({});
    mocks.db.send.mockImplementation(async () => ({ Items: [rows.get('PARTY#party/MSG#b'), rows.get('PARTY#party/MSG#a')] }));
    mocks.getItem.mockImplementation(async (pk: string, sk: string) => rows.get(`${pk}/${sk}`));
    mocks.transact.mockImplementation(async (actions: any[]) => {
        for (const action of actions) {
            if (action.Put)
                rows.set(`${action.Put.Item.PK}/${action.Put.Item.SK}`, structuredClone(action.Put.Item));
            if (action.Update?.Key.SK === 'META') {
                const meta = rows.get('PARTY#party/META')!;
                meta.notesRevision = action.Update.ExpressionAttributeValues[':next'];
                if (':one' in action.Update.ExpressionAttributeValues)
                    meta.notesEpoch = Number(meta.notesEpoch) + 1;
            }
        }
    });
});
afterEach(() => vi.unstubAllEnvs());
describe('party note ownership and revisions', () => {
    it('saves sourced notes and deduplicates repeated extraction', async () => {
        const first = await createPartyNote('party', 'alice', note, { epoch: 0 });
        const duplicate = await createPartyNote('party', 'alice', note, { epoch: 0 });
        expect(first?.id).toBe(duplicate?.id);
        expect(first?.kind).toBe('decision');
        expect(mocks.transact).toHaveBeenCalledTimes(1);
        const actions = mocks.transact.mock.calls[0][0];
        expect(actions.some((a: any) => a.ConditionCheck?.Key.SK === 'MEMBER#alice')).toBe(true);
    });
    it('reuses an extraction batch and cursor without another model call', async () => {
        const invoke = vi.fn(async () => ({ output: { message: { role: 'assistant', content: [{ text: JSON.stringify({ notes: [note] }) }] } } } as any));
        const trigger = { id: 'b', partyId: 'party', authorId: 'alice', role: 'user', runId: 'b', notesEpochAtCreation: 0 };
        await extractPartyNotes('party', trigger, invoke);
        await extractPartyNotes('party', trigger, invoke);
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(rows.get('PARTY#party/NOTE_CURSOR')?.through).toBe('b');
        expect([...rows.keys()].filter(key => key.includes('/FACT#'))).toHaveLength(1);
    });
    it('consolidates an exact repeated statement with different sources', async () => {
        const first = await createPartyNote('party', 'alice', note, { epoch: 0 });
        put('MSG#c', { id: 'c', partyId: 'party', authorId: 'bob', role: 'user', notesEpochAtCreation: 0 });
        const repeated = await createPartyNote('party', 'alice', { ...note, sourceMessageIds: ['a', 'c'] }, { epoch: 0 });
        expect(repeated?.id).toBe(first?.id);
        expect(mocks.transact).toHaveBeenCalledTimes(1);
    });
    it('does not turn a direct Vibe reminder request into an unresolved group question', async () => {
        const reminder = { id: 'c', partyId: 'party', authorId: 'alice', role: 'user', text: '@Vibe, remind me when we meet?', runId: 'c', notesEpochAtCreation: 0 };
        mocks.db.send.mockResolvedValue({ Items: [reminder] });
        const invoke = vi.fn();
        await extractPartyNotes('party', reminder, invoke);
        expect(invoke).not.toHaveBeenCalled();
        expect(mocks.transact).not.toHaveBeenCalled();
    });
    it('retries invalid structured extraction once and binds a valid preference to its source author', async () => {
        const warn = vi.spyOn(console,'warn').mockImplementation(()=>{});
        try {
            const invoke=vi.fn().mockResolvedValueOnce({output:{message:{role:'assistant',content:[{toolUse:{name:'record_party_notes',input:{notes:[{text:'Alice likes databases',kind:'preference',topic:'invalid',sourceMessageIds:['a']}]}}}]}}})
                .mockResolvedValueOnce({output:{message:{role:'assistant',content:[{toolUse:{name:'record_party_notes',input:{notes:[{text:'Alice likes databases',kind:'preference',topic:'interests',sourceMessageIds:['a']}]}}}]}}});
            await extractPartyNotes('party',{id:'b',partyId:'party',authorId:'alice',role:'user',runId:'b',notesEpochAtCreation:0},invoke);
            expect(invoke).toHaveBeenCalledTimes(2);
            expect([...rows.values()].find(row=>row.entityType==='PARTY_FACT')?.subjectId).toBe('alice');
        } finally { warn.mockRestore(); }
    });
    it('does not turn a single-author assertion into group agreement', async () => {
        expect((await createPartyNote('party', 'alice', { ...note, sourceMessageIds: ['a'] }, { epoch: 0 }))?.kind).toBe('suggestion');
    });
    it('rejects sources from another party or assistant messages', async () => {
        await expect(createPartyNote('other', 'alice', note, { epoch: 0 })).rejects.toThrow('Party not found');
        put('MSG#a', { role: 'assistant', partyId: 'party' });
        await expect(createPartyNote('party', 'alice', note, { epoch: 0 })).rejects.toThrow('human messages');
        expect(mocks.transact).not.toHaveBeenCalled();
    });
    it('writes source suppression, history and invalidation in the correction transaction', async () => {
        const created = await createPartyNote('party', 'alice', note, { epoch: 0 });
        const corrected = await changePartyNote('party', 'alice', created!.id, { version: 1, text: 'Meet on Saturday', kind: 'decision' });
        expect(corrected.version).toBe(2);
        expect(corrected.updatedBy).toBe('alice');
        expect(rows.get('PARTY#party/NOTE_SUPPRESS#a')).toBeDefined();
        expect(rows.get(`PARTY#party/NOTE_HISTORY#${created!.id}#1`)).toBeDefined();
        expect(await partyMessageIsCurrent('party', { id: 'a', role: 'user' })).toBe(false);
        expect(await createPartyNote('party', 'alice', { ...note, text: 'We meet Friday' }, { epoch: 0 })).toBeUndefined();
        expect(await createPartyNote('party', 'alice', note, { epoch: 1 })).toBeUndefined();
        await expect(changePartyNote('party', 'alice', created!.id, { version: 1, text: 'Stale', kind: 'decision' })).rejects.toThrow('Reload');
    });
    it('retains a tombstone and prevents deleted notes returning on redelivery', async () => {
        const created = await createPartyNote('party', 'alice', note, { epoch: 0 });
        await changePartyNote('party', 'alice', created!.id, { version: 1 }, true);
        expect(rows.get(`PARTY#party/FACT#${created!.id}`)?.deleted).toBe(true);
        expect(await createPartyNote('party', 'alice', note, { epoch: 0 })).toBeUndefined();
    });
    it('refuses writes from non-members and reports concurrent transaction conflicts', async () => {
        mocks.requireParty.mockRejectedValueOnce(new Error('Forbidden'));
        await expect(createPartyNote('party', 'eve', note)).rejects.toThrow('Forbidden');
        expect(mocks.transact).not.toHaveBeenCalled();
        mocks.transact.mockRejectedValueOnce(Object.assign(new Error('race'), { name: 'TransactionCanceledException' }));
        await expect(createPartyNote('party', 'alice', note)).rejects.toMatchObject({ statusCode: 409 });
    });
    it('invalidates old answer dependencies even when a corrected note has the same text', async () => {
        const dependency = { kind: 'party' as const, partyId: 'party', membershipRevision: 0, notesEpoch: 0 };
        expect(await memoryDependenciesCurrent([dependency])).toBe(true);
        rows.get('PARTY#party/META')!.notesEpoch = 1;
        expect(await memoryDependenciesCurrent([dependency])).toBe(false);
        const condition = memoryDependencyCondition({ ...dependency, notesEpoch: 1 });
        expect(condition.ConditionCheck.ConditionExpression).toContain('notesEpoch = :notesEpoch');
        expect(condition.ConditionCheck.ConditionExpression).not.toContain('attribute_not_exists(notesEpoch)');
    });
    it('background additions preserve answer snapshots while a correction invalidates them', async () => {
        const dependency = {kind:'party' as const,partyId:'party',membershipRevision:0,notesEpoch:0};
        await createPartyNote('party','alice',note,{epoch:0});
        expect(await memoryDependenciesCurrent([dependency])).toBe(true);
        const created = [...rows.values()].find(row => row.entityType === 'PARTY_FACT')!;
        await changePartyNote('party','alice',String(created.id),{version:1,text:'Saturday',kind:'decision'});
        expect(await memoryDependenciesCurrent([dependency])).toBe(false);
    });
    it('consolidates preferences by authenticated subject/topic and rejects another member editing them', async () => {
        const first = await createPartyNote('party','alice',{text:'Alice likes databases.',kind:'preference',topic:'interests',subjectMessageId:'a',sourceMessageIds:['a']},{epoch:0});
        put('MSG#c',{id:'c',partyId:'party',authorId:'alice',authorName:'Alice',role:'user',notesEpochAtCreation:0});
        const next = await createPartyNote('party','bob',{text:'Alice likes databases and circuits.',kind:'preference',topic:'interests',subjectMessageId:'c',sourceMessageIds:['c']},{epoch:0});
        expect(next?.id).toBe(first?.id); expect(next?.version).toBe(2); expect(next?.subjectId).toBe('alice');
        expect(next?.sourceMessageIds).toEqual(['a','c']);
        await expect(changePartyNote('party','bob',next!.id,{version:2,text:'Overwrite',kind:'preference'})).rejects.toMatchObject({statusCode:403});
        await expect(createPartyNote('party','bob',{text:'Wrong subject',kind:'preference',topic:'interests',subjectMessageId:'a',sourceMessageIds:['a','b']},{epoch:0})).rejects.toMatchObject({statusCode:400});
    });
    it('ignores source-free repetitions of current context without dropping supported updates', () => {
        const result=parsePartyNotes(JSON.stringify({notes:[{text:'Existing context',kind:'decision',sourceMessageIds:[]},{text:'Alice likes circuits',kind:'preference',topic:'interests',sourceMessageIds:['a']}]}),new Set(['a']));
        expect(result).toHaveLength(1);expect(result[0].topic).toBe('interests');
    });
    it('rejects fabricated source IDs and malformed extractor output', () => {
        expect(() => parsePartyNotes(JSON.stringify({ notes: [note] }), new Set(['a']))).toThrow('unknown source');
        expect(() => parsePartyNotes('{"notes":[{"text":"x","kind":"accepted","sourceMessageIds":["a"]}]}', new Set(['a']))).toThrow();
        expect(noteId(note)).toBe(noteId({ ...note, sourceMessageIds: ['b', 'a'] }));
    });
});
