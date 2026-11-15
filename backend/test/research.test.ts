import { describe, it, expect, vi } from 'vitest';
import { compareSchedules, runResearch, publicUrl, safeAnswerText, schemas, type ResearchState } from '../src/research.js';
const meeting = { days: ['MON'], start: '09:00', end: '10:00', start_date: '2027-01-01', end_date: '2027-05-01', status: 'scheduled' };
const input = (other: object) => ({ sections: [{ id: 'a', timezone: 'America/Phoenix', meetings: [meeting] }, { id: 'b', timezone: 'America/Phoenix', meetings: [{ ...meeting, ...other }] }] });
describe('research correctness boundaries', () => {
    it('supports level-scoped discovery without inventing catalog numbers', () => {
        expect(schemas.discover_courses.parse({term:'Spring 2027',subject:'CSE',level:500})).toMatchObject({level:500,keywords:''});
        expect(schemas.discover_courses.safeParse({term:'Spring 2027',subject:'CSE',level:550}).success).toBe(false);
    });
    it('exposes keyword/instructor filters without requiring a course number', () => {
        expect(schemas.search_classes.parse({term:'Spring 2027',keywords:'machine learning',instructor:'Sample Professor',campus:'TEMPE',search_type:'open',days:'MW',start_date:'2027-01-11'})).toMatchObject({keywords:'machine learning',instructor:'Sample Professor'});
        expect(schemas.search_classes.safeParse({term:'Spring 2027'}).success).toBe(false);
        expect(schemas.search_classes.safeParse({term:'Spring 2027',keywords:'AI',url:'https://untrusted.example'}).success).toBe(false);
        expect(schemas.get_syllabus_evidence.parse({term:'Spring 2027',subject:'CSE',catalog_nbr:'511',fallback_terms:['Fall 2026','Summer 2026','Spring 2026']})).toHaveProperty('fallback_terms');
        expect(schemas.get_professor_reviews.parse({teacher_id:'123',max_pages:6,cursor:'next-page'})).toMatchObject({max_pages:6,cursor:'next-page'});
    });
    it('does not publish textual tool calls as a finished answer', async () => {
        expect(safeAnswerText('Now searching: <function_calls><function_call>search_classes</function_call></function_calls>')).not.toContain('<function');
        expect(safeAnswerText('Database options [S1]')).toBe('Database options [S1]');
        expect(safeAnswerText('<｜DSML｜function_calls')).not.toContain('DSML');
        const result = await runResearch({messages:[],deadline:Date.now()+10000,load:async()=>undefined,save:async()=>{},
            invoke:async()=>({output:{message:{role:'assistant',content:[{text:'<function_calls>search_classes</function_calls>'}]}}} as any)});
        expect(result.text).not.toContain('<function');
        expect(result.researchWarnings.join(' ')).toContain('malformed tool markup');
    });
    it('checks overlap, adjacency, dates and unknown times', () => {
        expect(compareSchedules(input({ start: '09:30' })).status).toBe('conflict');
        expect(compareSchedules(input({ start: '10:00', end: '11:00' })).status).toBe('no_overlap');
        expect(compareSchedules(input({ start: null })).status).toBe('unverified');
        expect(compareSchedules(input({ start: undefined, end: undefined, status: 'unknown' })).status).toBe('unverified');
        expect(compareSchedules(input({ start_date: '2027-06-01', end_date: '2027-07-01' })).status).toBe('no_overlap');
    });
    it('rejects private-looking URLs and credentials', () => { for (const s of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:secret@example.com'])
        expect(publicUrl(s)).toBe(false); });
    it('persists successful tools across a transient model failure and rejects invented citations', async () => {
        let saved: ResearchState | undefined;
        const invoke = vi.fn().mockResolvedValueOnce({ output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't', name: 'compare_group_schedules', input: input({ start: '10:00', end: '11:00' }) } }] } } }).mockRejectedValueOnce(Error('transient'));
        const options = { messages: [], deadline: Date.now() + 10000, invoke, load: async () => saved, save: async (s: ResearchState) => { saved = structuredClone(s); } };
        await expect(runResearch(options)).rejects.toThrow('transient');
        expect(saved?.calls).toBe(1);
        invoke.mockResolvedValueOnce({ output: { message: { role: 'assistant', content: [{ text: 'No overlap [S999]' }] } } });
        expect((await runResearch(options)).text).toBe('No overlap [source unavailable]');
        expect(saved?.calls).toBe(1);
    });
    it('synthesizes a bounded partial answer without sending tool blocks after tool access is removed', async () => {
        const invoke = vi.fn(async (messages: any[], available: any[]) => {
            if (available.length) return { output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't', name: 'compare_group_schedules', input: input({ start: null }) } }] } } } as any;
            expect(messages.flatMap(m => m.content).some(c => c.toolUse || c.toolResult)).toBe(false);
            return { output: { message: { role: 'assistant', content: [{ text: 'Meetings remain unverified.' }] } } } as any;
        });
        const result = await runResearch({ messages: [], deadline: Date.now() + 10000, invoke, load: async () => undefined, save: async () => {} });
        expect(result.text).toContain('unverified');
        expect(result.researchWarnings).toContain('Research call limit reached; this answer uses the evidence already collected.');
    });
    it('deduplicates persisted warnings in the published result', async () => {
        const state = {messages:[],round:0,calls:0,searches:0,fetches:0,characters:0,inputTokens:0,outputTokens:0,citations:[],warnings:['Limited sample','Limited sample'],nextTool:0} as ResearchState;
        const result=await runResearch({messages:[],deadline:Date.now()+10000,load:async()=>state,save:async()=>{},invoke:async()=>({output:{message:{role:'assistant',content:[{text:'A cautious review assessment.'}]}}} as any)});
        expect(result.researchWarnings).toEqual(['Limited sample']);
        expect(schemas.get_professor_reviews.parse({teacher_id:'123',course:'CSE 475'})).toMatchObject({course:'CSE 475'});
    });
    it('enforces the tool-round bound', async () => {
        const invoke = vi.fn(async () => ({ output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't', name: 'compare_group_schedules', input: input({ start: null }) } }] } } } as any));
        await expect(runResearch({ messages: [], deadline: Date.now() + 10000, invoke, load: async () => undefined, save: async () => { } })).rejects.toThrow('round limit');
        expect(invoke).toHaveBeenCalledTimes(5);
    });
});
