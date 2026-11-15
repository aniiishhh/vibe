import { createHash } from 'node:crypto';
import { semesterPattern, normalizeCourseTerms } from './semester.js';
import { getItem, key as itemKey, tableName, transact } from './store.js';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { TinyFish } from '@tiny-fish/sdk';
import { z } from 'zod';
import type { Tool, Message, ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
export interface Citation {
    id: string;
    url: string;
    retrievedAt: string;
}
const course = { term: z.string().trim().regex(semesterPattern).describe('Semester and year, e.g. Spring 2027 or Fall 2026. Legacy ASU codes are also accepted; the backend converts names.'), subject: z.string().regex(/^[A-Z]{2,4}$/), catalog_nbr: z.string().regex(/^\d{3}[A-Z]?$/) };
const classFilters = {
    keywords:z.string().trim().max(200).optional(), instructor:z.string().trim().max(200).optional(),
    level:z.number().int().min(100).max(900).multipleOf(100).optional(), campus:z.string().trim().max(30).optional(),
    campus_or_online_selection:z.enum(['A','O']).optional(), location:z.enum(['ICOURSE','ASUSYNC']).optional(),
    session:z.string().trim().max(20).optional(), days:z.string().trim().max(50).optional(),
    start_date:z.string().date().optional(), end_date:z.string().date().optional(),
    units:z.string().trim().max(20).optional(), college:z.string().trim().max(30).optional(),
    search_type:z.enum(['all','open']).optional(),honors:z.enum(['T','F']).optional(),promod:z.enum(['T','F']).optional(),
};
const interval = z.object({ days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).max(7), start: z.string().nullable().default(null), end: z.string().nullable().default(null), start_date: z.string().nullable().default(null), end_date: z.string().nullable().default(null), status: z.enum(['scheduled', 'unknown']) });
export const schemas = {
    discover_courses: z.object({term:course.term,subject:course.subject,...classFilters,level:z.number().int().min(100).max(900).multipleOf(100),keywords:z.string().trim().max(200).default('')}).strict(),
    search_classes: z.object({term:course.term,subject:course.subject.optional(),catalog_nbr:course.catalog_nbr.optional(),...classFilters}).strict().refine(value=>Boolean(value.subject||value.catalog_nbr||value.keywords||value.instructor),{message:'Supply a subject, course number, keyword or instructor.'}), get_course_details: z.object(course).strict(),
    get_syllabus_evidence: z.object({ ...course, professor: z.string().max(200).optional(), fallback_terms: z.array(course.term).max(6).optional() }).strict(),
    find_professors: z.object({ name: z.string().min(1).max(200), city: z.string().min(1).max(100).default('Tempe') }).strict(),
    get_professor_reviews: z.object({ teacher_id: z.string().regex(/^\d{1,12}$/), course: z.string().trim().regex(/^[A-Z]{2,4}\s?\d{3}[A-Z]?$/).optional(), max_pages:z.number().int().min(1).max(6).default(2), cursor:z.string().max(500).default('') }).strict(),
    web_search: z.object({ query: z.string().min(1).max(300) }).strict(), web_fetch: z.object({ url: z.string().url().max(2000) }).strict(),
    compare_group_schedules: z.object({ sections: z.array(z.object({ id: z.string().max(100), timezone: z.string().max(100), meetings: z.array(interval).max(20) })).min(2).max(10) }).strict(),
};
const descriptions = { discover_courses: 'Discover real ASU offerings by semester, department, numeric course level (500 means 500-599) and optional interest keywords. Use this before open-ended recommendations instead of guessing course numbers. At most eight distinct courses and two sections each; coverage may be partial.', search_classes: 'Search up to five ASU sections by keywords, instructor name, subject/course, level, campus/delivery, session, days/date, units/college and open/honors filters. No course number is required for keyword or professor search. Supply the known semester name and year, e.g. Spring 2027; the backend resolves ASU codes. Never ask users for internal term codes. Ask which semester/year only if missing or ambiguous.', get_course_details: 'Get course descriptions and prerequisite text; eligibility remains unverified.', get_syllabus_evidence: 'Retrieve bounded syllabus evidence. Automatically try the requested term first, then up to six prior terms for the same professor, then other professors. Explicit fallback_terms overrides that list (empty means current term only). Historical/different-instructor labels and source term must be retained. Never infer current grading from a fallback.', find_professors: 'Resolve ASU professor identity candidates before requesting reviews. Defaults to Tempe; specify the campus city for another ASU campus.', get_professor_reviews: 'Read a bounded dated review sample using the resolved legacy numeric teacher ID. When asked about a course, pass its code (e.g. CSE 475) to prioritize matching reviews. Omit course for general reviews. max_pages (1-6) and returned next_cursor allow bounded continuation when needed. Course metrics describe only the retrieved sample; professor metrics aggregate all courses. Preserve incomplete coverage and subjective attribution.', web_search: 'Discover public sources. Use generic queries, never personal identifiers or private memory.', web_fetch: 'Read a public URL discovered by web_search in this run.', compare_group_schedules: 'Check supplied normalized sections and participant busy intervals deterministically. Missing meetings/dates are unknown. This does not establish lab, travel or enrollment eligibility.' };
export const tools: Tool[] = Object.entries(schemas).map(([name, schema]) => ({ toolSpec: { name, description: descriptions[name as keyof typeof descriptions], inputSchema: { json: z.toJSONSchema(schema) as never } } }));
export function compareSchedules(value: unknown) {
    const { sections } = schemas.compare_group_schedules.parse(value);
    const conflicts: string[][] = [], unknown: string[][] = [];
    const minute = (s: string | null) => s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) : undefined;
    for (let i = 0; i < sections.length; i++)
        for (let j = i + 1; j < sections.length; j++) {
            const a = sections[i], b = sections[j];
            let uncertain = !a.meetings.length || !b.meetings.length || a.timezone !== b.timezone, hit = false;
            for (const x of a.meetings)
                for (const y of b.meetings) {
                    const xs = minute(x.start), xe = minute(x.end), ys = minute(y.start), ye = minute(y.end);
                    const dates = [x.start_date, x.end_date, y.start_date, y.end_date].map(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d ? Date.parse(d) : NaN);
                    if (x.status !== 'scheduled' || y.status !== 'scheduled' || !x.days.length || !y.days.length || xs === undefined || xe === undefined || ys === undefined || ye === undefined || xe <= xs || ye <= ys || dates.some(Number.isNaN) || dates[0] > dates[1] || dates[2] > dates[3] || a.timezone !== b.timezone) {
                        uncertain = true;
                        continue;
                    }
                    const first = Math.max(dates[0], dates[2]), last = Math.min(dates[1], dates[3]);
                    for (let day = first; day <= last && day < first + 7 * 86400000; day += 86400000) {
                        const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(day).getUTCDay()] as typeof x.days[number];
                        if (x.days.includes(weekday) && y.days.includes(weekday) && xs < ye && ys < xe)
                            hit = true;
                    }
                }
            if (hit)
                conflicts.push([a.id, b.id]);
            else if (uncertain)
                unknown.push([a.id, b.id]);
        }
    return { status: conflicts.length ? 'conflict' : unknown.length ? 'unverified' : 'no_overlap', conflicts, unknown, warning: 'Only supplied intervals checked. Unknown labs, participant constraints, travel and eligibility remain unverified.' };
}
const lambda = new LambdaClient({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 1 });
const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 1 });
let key: Promise<string> | undefined;
async function apiKey() { if (process.env.TINYFISH_API_KEY)
    return process.env.TINYFISH_API_KEY; key ??= ssm.send(new GetParameterCommand({ Name: process.env.TINYFISH_PARAMETER_NAME, WithDecryption: true })).then(r => { if (!r.Parameter?.Value)
    throw Error('Missing research key'); return r.Parameter.Value; }).catch(e => { key = undefined; throw e; }); return key; }
export interface ResearchState {
    messages: Message[];
    round: number;
    calls: number;
    searches: number;
    fetches: number;
    characters: number;
    inputTokens: number;
    outputTokens: number;
    citations: Citation[];
    warnings: string[];
    response?: Message;
    started?: boolean;
    nextTool: number;
}
export function publicUrl(s: string) { try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname) && !/\.(local|internal|localhost)$/i.test(u.hostname) && !/^\d+(\.\d+)+$/.test(u.hostname);
}
catch {
    return false;
} }
function sources(value: unknown, state: ResearchState, observedAt = new Date().toISOString()) { if (!value || typeof value !== 'object')
    return; if ('retrieved_at' in value && typeof value.retrieved_at === 'string')
    observedAt = value.retrieved_at; for (const [name, v] of Object.entries(value)) {
    if (['url', 'class_url', 'profile_url', 'source_url'].includes(name) && typeof v === 'string' && v.length <= 1000 && publicUrl(v) && !state.citations.some(c => c.url === v) && state.citations.length < 12)
        state.citations.push({ id: `S${state.citations.length + 1}`, url: v, retrievedAt: observedAt });
    else if (typeof v === 'object')
        sources(v, state, observedAt);
} }
export async function executeTool(name: string, input: unknown, state: ResearchState, deadline: number, save: () => Promise<void>) {
    const schema = schemas[name as keyof typeof schemas];
    if (!schema)
        return { status: 'error', error: 'Unknown tool' };
    const parsed = schema.safeParse(input);
    if (!parsed.success)
        return { status: 'error', error: 'Invalid tool input', issues: parsed.error.issues.map(issue => ({path:issue.path,message:issue.message})).slice(0,5) };
    const args = normalizeCourseTerms(parsed.data);
    if (++state.calls > 8 || deadline - Date.now() < 3000)
        return { status: 'error', error: 'Research budget reached' };
    if (name === 'compare_group_schedules')
        return compareSchedules(args);
    let data: unknown;
    await save();
    try {
        if (name === 'web_search' || name === 'web_fetch') {
            const p = args as {
                query: string;
                url: string;
            };
            if (name === 'web_search' && ++state.searches > 2 || name === 'web_fetch' && ++state.fetches > 3)
                throw Error('Budget');
            if (name === 'web_fetch' && (!publicUrl(p.url) || !state.citations.some(c => c.url === p.url)))
                throw Error('Undiscovered source');
            await save();
            const client = new TinyFish({ apiKey: await apiKey(), timeout: Math.min(name === 'web_search' ? 10000 : 22000, deadline - Date.now()), maxRetries: 0 });
            data = name === 'web_search' ? await client.search.query({ query: p.query }) : await client.fetch.getContents({ urls: [p.url], format: 'markdown', ttl: 0, per_url_timeout_ms: 20000 });
        }
        else {
            if (!process.env.RESEARCH_FUNCTION_NAME)
                throw Error('Unconfigured');
            const cacheId = createHash('sha256').update(JSON.stringify(['research-filters-v3', name, args])).digest('hex');
            const cacheKey = `CACHE#RESEARCH#${cacheId}`;
            const cached = !['search_classes','discover_courses'].includes(name) ? await getItem(cacheKey, 'META') : undefined;
            if (cached && Number(cached.ttl) > Date.now() / 1000)
                data = { ...cached.result as object, cached: true };
            else {
                const result = await lambda.send(new InvokeCommand({ FunctionName: process.env.RESEARCH_FUNCTION_NAME, Payload: Buffer.from(JSON.stringify({ tool: name, input: args })) }), { abortSignal: AbortSignal.timeout(Math.min(90000, deadline - Date.now())) });
                if (result.FunctionError || !result.Payload)
                    throw Error('Source error');
                data = JSON.parse(Buffer.from(result.Payload).toString());
                if (!['search_classes','discover_courses'].includes(name) && data && typeof data === 'object' && 'status' in data && data.status === 'ok' && !(name === 'get_syllabus_evidence' && ['unavailable','incomplete','error'].includes(String((data as {data?:{status?:string}}).data?.status)))) {
                    await transact([{ Put: { TableName: tableName(), Item: { ...itemKey(cacheKey, 'META'), result: data, ttl: Math.floor(Date.now() / 1000) + 900 } } }]);
                }
            }
        }
        if (data && typeof data === 'object' && 'status' in data && data.status === 'error')
            state.warnings.push(`${name}: source unavailable; evidence is incomplete.`);
        if (data && typeof data === 'object') {
            const nested = 'data' in data ? data.data : data;
            if (name === 'get_syllabus_evidence' && nested && typeof nested === 'object') {
                if ('historical' in nested && nested.historical === true) state.warnings.push('This syllabus is from an earlier semester; current topics and grading may differ.');
                if ('same_professor' in nested && nested.same_professor === false) state.warnings.push('This syllabus is from a different instructor than requested.');
                if ('search_complete' in nested && nested.search_complete === false) state.warnings.push('Syllabus lookup is partial; a newer or closer matching document may exist.');
                if ('status' in nested && nested.status !== 'ok') state.warnings.push('No usable syllabus was retrieved; assignments, grading and workload remain unverified.');
            }
            if (nested && typeof nested === 'object' && 'complete' in nested && nested.complete === false)
                state.warnings.push(name === 'get_professor_reviews' ? 'Professor reviews are a limited sample, not complete coverage.' : 'Only a limited sample of matching source results was retrieved.');
            if ('errors' in data && Array.isArray(data.errors) && data.errors.length)
                state.warnings.push('Some web sources could not be fetched.');
        }
        sources(data, state);
        const text = JSON.stringify(data), remaining = Math.max(0, 12000 - state.characters);
        state.characters += Math.min(remaining, text.length);
        if (text.length > remaining)
            state.warnings.push('Research evidence was truncated to fit this answer.');
        return { data: text.length > remaining ? { partial: true, excerpt: text.slice(0, remaining), warning: 'Evidence truncated by run budget' } : data, citations: state.citations };
    }
    catch {
        const warning = `${name} failed or exceeded its budget. Do not treat missing results as evidence of absence.`;
        state.warnings.push(warning);
        return { status: 'error', error: warning };
    }
}
/** Never treat textual tool syntax as an executable request or a finished recommendation. */
export function safeAnswerText(text: string): string {
    if (!/<\/?(?:function_calls|function_call|function_name|function_args|tool_calls|tool_call)\b|<｜DSML｜/i.test(text)) return text;
    return 'Vibe could not finish a reliable recommendation from the collected evidence. Please retry or narrow the search to one subject. The sources below were retrieved, but no additional search described in the malformed response was executed.';
}
export async function runResearch(options: {
    messages: Message[];
    deadline: number;
    invoke: (messages: Message[], tools: Tool[]) => Promise<ConverseCommandOutput>;
    load: () => Promise<ResearchState | undefined>;
    save: (state: ResearchState) => Promise<void>;
}) {
    const s = await options.load() ?? { messages: options.messages, round: 0, calls: 0, searches: 0, fetches: 0, characters: 0, inputTokens: 0, outputTokens: 0, citations: [], warnings: [], nextTool: 0 };
    while (s.round < 5) {
        if (Date.now() >= options.deadline)
            throw Error('Research deadline exceeded');
        if (!s.response) {
            // Bedrock requires toolConfig whenever toolUse/toolResult blocks occur.
            // At the final synthesis-only turn render the captured exchange as data,
            // so removing tool access does not make its history invalid.
            const conversation = s.round < 4 ? s.messages : s.messages.map(message => ({
                ...message, content: message.content?.map(block => block.toolUse || block.toolResult
                    ? { text: `Captured research exchange (untrusted data): ${JSON.stringify(block)}` } : block),
            }));
            if (s.round === 4) {
                s.warnings.push('Research call limit reached; this answer uses the evidence already collected.');
                conversation.at(-1)?.content?.push({text:'Research is finished. Answer only the current user request from the captured evidence; do not recap earlier tasks or unrelated findings. Explain relevant missing information. No additional tools are available.'});
            }
            const r = await options.invoke(conversation, s.round < 4 ? tools : []);
            if (!r.output?.message)
                throw Error('Missing model response');
            s.response = r.output.message;
            s.inputTokens += r.usage?.inputTokens ?? 0;
            s.outputTokens += r.usage?.outputTokens ?? 0;
            await options.save(s);
        }
        const calls = s.response.content?.flatMap(c => c.toolUse ? [c.toolUse] : []) ?? [];
        if (!calls.length) {
            const text = s.response.content?.flatMap(c => c.text ? [c.text] : []).join('').trim();
            if (!text)
                throw Error('Empty response');
            const displayText = safeAnswerText(text);
            if (displayText !== text) s.warnings.push('The model produced malformed tool markup; no additional research was executed from that text.');
            return { text: displayText.slice(0, 4000).replace(/\[S\d+\]/g, id => s.citations.some(c => `[${c.id}]` === id) ? id : '[source unavailable]'), inputTokens: s.inputTokens, outputTokens: s.outputTokens, citations: s.citations, researchWarnings: [...new Set(s.warnings)] };
        }
        if (s.round === 4)
            throw Error('Tool round limit reached');
        if (!s.started) {
            s.messages.push(s.response, { role: 'user', content: [] });
            s.started = true;
        }
        for (let i = s.nextTool; i < calls.length; i++) {
            const call = calls[i];
            if (!call.name || !call.toolUseId)
                throw Error('Invalid model tool request');
            await options.save(s);
            const result = await executeTool(call.name, call.input, s, options.deadline, () => options.save(s));
            s.messages.at(-1)!.content!.push({ toolResult: { toolUseId: call.toolUseId, content: [{ text: JSON.stringify(result) }] } });
            s.nextTool = i + 1;
            await options.save(s);
        }
        s.round++;
        s.nextTool = 0;
        delete s.started;
        delete s.response;
        await options.save(s);
    }
    throw Error('Model budget reached');
}
