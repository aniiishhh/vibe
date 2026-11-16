/* In-browser mock of the Vibe API for the demo video. It answers every /api route the UI calls
 * from an in-memory store, and exposes window.__director so capture scripts can drive scenes. */
import type { AgentRun, Member, MemoryFact, Message, Party, PartyFact, PartyTask, Profile } from '@vibe/shared';
import { emitPartyEvent } from './amplify-stub';
import {
  CLASS_CHATTER, CLASS_ID, ME, PEOPLE, REPLIES, TRIP_CHATTER, TRIP_ID, chatterMessages, makeMembers, makeParty, seedMemories, type ReplySpec,
} from './scenarios';

interface Store {
  profile: Profile;
  parties: Party[];
  members: Record<string, Member[]>;
  messages: Record<string, Message[]>;
  runs: Record<string, AgentRun[]>;
  facts: Record<string, PartyFact[]>;
  tasks: Record<string, PartyTask[]>;
  memories: MemoryFact[];
}

let counter = 100;
const nextId = (prefix: string) => `${prefix}-${String(counter++).padStart(5, '0')}`;
const now = () => new Date().toISOString();

const params = new URLSearchParams(window.location.search);
/** home | class | class-chatter | class-done | trip | trip-chatter | memory | pip */
const scene = params.get('scene') ?? 'class-chatter';

function seed(): Store {
  const store: Store = {
    profile: { id: ME, name: 'Maya', email: 'maya@asu.edu', learningEnabled: true, memoryRevision: 1 },
    parties: [], members: {}, messages: {}, runs: {}, facts: {}, tasks: {},
    memories: seedMemories(scene !== 'memory'),
  };
  if (scene === 'home') return store;
  const classParty = makeParty(CLASS_ID, 'Classes next semester', 'Find classes we can take together.', 'study', 300);
  const tripParty = makeParty(TRIP_ID, 'Saturday day trip', 'Pick a day trip from Tempe everyone’s up for.', 'outdoors', 120);
  const chillParty = makeParty('p-chill', 'Roommate stuff', 'Chores, groceries and movie nights.', 'chill', 900);
  store.parties = [tripParty, classParty, chillParty];
  for (const party of store.parties) {
    store.members[party.id] = makeMembers(party.id === TRIP_ID ? scene !== 'memory' : true);
    store.messages[party.id] = [];
    store.runs[party.id] = [];
    store.facts[party.id] = [];
    store.tasks[party.id] = [];
  }
  if (scene !== 'class') store.messages[CLASS_ID] = chatterMessages(CLASS_ID, CLASS_CHATTER, 10, 50);
  if (scene === 'trip-chatter' || scene === 'memory' || scene === 'pip') store.messages[TRIP_ID] = chatterMessages(TRIP_ID, TRIP_CHATTER, 30, 20);
  store.messages['p-chill'] = chatterMessages('p-chill', [['u-leo', 'movie night friday?'], ['u-priya', 'yes!! I’ll bring snacks']], 50, 200);
  return store;
}

const store = seed();

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function themeFor(text: string): Party['theme'] {
  const rules: Array<[RegExp, NonNullable<Party['theme']>]> = [
    [/class|course|study|exam|semester|homework/i, 'study'],
    [/hackathon|build|code|project|idea/i, 'build'],
    [/dinner|food|eat|lunch|restaurant/i, 'food'],
    [/hike|trail|camp|sedona|park|outdoor|day trip/i, 'outdoors'],
    [/birthday|celebrat|party/i, 'celebrate'],
    [/trip|travel|flight|weekend|stay|hotel/i, 'travel'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? 'chill';
}

function findReply(text: string): ReplySpec {
  return REPLIES.find(({ match }) => match.test(text))?.reply ?? { text: 'On it! Here’s what I found.', thinkMs: 3000 };
}

function addMessage(partyId: string, authorId: string, text: string, clientId?: string) {
  const message: Message = { id: nextId('m'), partyId, authorId, authorName: PEOPLE[authorId] ?? 'Someone', role: 'user', text, createdAt: now() };
  void clientId;
  store.messages[partyId].push(message);
  let run: AgentRun | undefined;
  if (/@vibe(?![\p{L}\p{N}_])/iu.test(text)) {
    run = { id: nextId('run'), partyId, triggerMessageId: message.id, status: 'queued', createdAt: now() };
    store.runs[partyId].push(run);
    playRun(partyId, run, message, findReply(text));
  }
  emitPartyEvent();
  return { message, run };
}

function playRun(partyId: string, run: AgentRun, trigger: Message, reply: ReplySpec) {
  window.setTimeout(() => { run.status = 'thinking'; emitPartyEvent(); }, 900);
  window.setTimeout(() => {
    const retrievedAt = now();
    const answer: Message = {
      id: nextId('m'), partyId, authorId: 'vibe', authorName: 'Vibe', role: 'assistant', text: reply.text, createdAt: now(), runId: run.id,
      citations: reply.citations?.map((url, index) => ({ id: String(index + 1), url, retrievedAt })),
      researchWarnings: reply.warnings,
    };
    store.messages[partyId].push(answer);
    run.status = 'completed';
    run.replyMessageId = answer.id;
    if (reply.task) {
      store.tasks[partyId].push({
        id: nextId('task'), partyId, title: reply.task.title, description: reply.task.description ?? '', assigneeId: reply.task.assigneeId ?? undefined,
        status: reply.task.status ?? 'proposed', version: 1, proposedBy: 'vibe', createdAt: now(), updatedAt: now(),
      });
    }
    for (const fact of reply.facts ?? []) {
      store.facts[partyId].push({ id: nextId('fact'), text: fact.text, kind: fact.kind, speakerId: trigger.authorId, sourceMessageIds: [trigger.id], createdAt: now(), updatedAt: now(), version: 1, source: 'conversation' });
    }
    emitPartyEvent();
  }, 900 + (reply.thinkMs ?? 4000));
}

type Handler = (match: RegExpMatchArray, body: Record<string, unknown>) => unknown | Promise<unknown>;
const routes: Array<[string, RegExp, Handler]> = [];
const route = (method: string, pattern: string, handler: Handler) => routes.push([method, new RegExp(`^${pattern}$`), handler]);
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const party = (id: string) => store.parties.find((item) => item.id === id);
const memoryList = () => ({
  memories: store.memories,
  profilePreview: store.memories.filter((memory) => memory.approval === 'approved').map((memory) => memory.text).join(' '),
  memoryRevision: 1,
  extractionState: 'idle',
});

route('GET', '/me', () => store.profile);
route('PUT', '/me', (_, body) => Object.assign(store.profile, body));
route('GET', '/me/memories', memoryList);
route('GET', '/me/memory-profile', () => ({
  revision: 1, providerStatus: 'ok', checkedAt: now(), truncated: false,
  buckets: [...new Set(store.memories.map((memory) => memory.category))].map((category) => ({
    category, points: store.memories.filter((memory) => memory.category === category).map((memory) => ({ id: memory.id, text: memory.text, approval: memory.approval })),
  })),
}));
route('POST', '/me/memories', (_, body) => {
  const memory: MemoryFact = { id: nextId('mem'), ownerId: ME, text: String(body.text), category: String(body.category ?? ''), version: 1, approval: body.approved ? 'approved' : 'private', source: 'manual', createdAt: now(), updatedAt: now(), syncState: 'synced' };
  store.memories.unshift(memory);
  return memory;
});
route('PATCH', '/me/memories/([^/]+)', async ([, id], body) => {
  await wait(350);
  const memory = store.memories.find((item) => item.id === decodeURIComponent(id))!;
  if (typeof body.text === 'string') memory.text = body.text;
  if (typeof body.category === 'string') memory.category = body.category;
  if (typeof body.approved === 'boolean') { memory.approval = body.approved ? 'approved' : 'private'; memory.approvedVersion = body.approved ? memory.version + 1 : undefined; }
  memory.version += 1;
  memory.updatedAt = now();
  return memory;
});
route('DELETE', '/me/memories/([^/]+)', ([, id]) => {
  const memory = store.memories.find((item) => item.id === decodeURIComponent(id))!;
  store.memories = store.memories.filter((item) => item !== memory);
  return { ...memory, deleted: true };
});
route('GET', '/parties', () => ({ parties: store.parties }));
route('POST', '/parties', async (_, body) => {
  await wait(1800);
  const created: Party = { ...makeParty(nextId('p'), String(body.name), String(body.goal), themeFor(`${body.name} ${body.goal}`), 0), mode: (body.mode as Party['mode']) ?? 'friendly' };
  store.parties.unshift(created);
  store.members[created.id] = makeMembers(true);
  store.messages[created.id] = [];
  store.runs[created.id] = [];
  store.facts[created.id] = [];
  store.tasks[created.id] = [];
  return created;
});
route('GET', '/parties/([^/]+)', ([, id]) => party(decodeURIComponent(id)));
route('PATCH', '/parties/([^/]+)', ([, id], body) => {
  const found = party(decodeURIComponent(id))!;
  found.mode = body.mode as Party['mode'];
  found.settingsVersion = (found.settingsVersion ?? 0) + 1;
  return found;
});
route('POST', '/parties/([^/]+)/theme', ([, id]) => party(decodeURIComponent(id)));
route('PATCH', '/parties/([^/]+)/archive', ([, id], body) => Object.assign(party(decodeURIComponent(id))!, { archived: body.archived }));
route('GET', '/parties/([^/]+)/members', ([, id]) => ({ members: store.members[decodeURIComponent(id)] ?? [] }));
route('PATCH', '/parties/([^/]+)/membership', async ([, id], body) => {
  await wait(250);
  const member = store.members[decodeURIComponent(id)].find((item) => item.userId === ME)!;
  member.useSharedMemory = Boolean(body.useSharedMemory);
  return member;
});
route('PATCH', '/parties/([^/]+)/members/([^/]+)', ([, id, userId], body) => {
  const member = store.members[decodeURIComponent(id)].find((item) => item.userId === decodeURIComponent(userId))!;
  member.role = body.role as Member['role'];
  return { members: store.members[decodeURIComponent(id)] };
});
route('DELETE', '/parties/([^/]+)/members/([^/]+)', () => undefined);
route('GET', '/parties/([^/]+)/facts', ([, id]) => ({ facts: store.facts[decodeURIComponent(id)] ?? [] }));
route('POST', '/parties/([^/]+)/facts', ([, id], body) => {
  const fact: PartyFact = { id: nextId('fact'), text: String(body.text), kind: body.kind as PartyFact['kind'], speakerId: ME, sourceMessageIds: [], createdAt: now(), version: 1, source: 'manual' };
  store.facts[decodeURIComponent(id)].push(fact);
  return fact;
});
route('PATCH', '/parties/([^/]+)/facts/([^/]+)', ([, id, factId], body) => {
  const fact = store.facts[decodeURIComponent(id)].find((item) => item.id === decodeURIComponent(factId))!;
  return Object.assign(fact, { text: body.text, kind: body.kind, version: (fact.version ?? 1) + 1, lastEditorId: ME, updatedAt: now() });
});
route('DELETE', '/parties/([^/]+)/facts/([^/]+)', ([, id, factId]) => {
  store.facts[decodeURIComponent(id)] = store.facts[decodeURIComponent(id)].filter((item) => item.id !== decodeURIComponent(factId));
  return {};
});
route('GET', '/parties/([^/]+)/tasks', ([, id]) => ({ tasks: store.tasks[decodeURIComponent(id)] ?? [] }));
route('POST', '/parties/([^/]+)/tasks', ([, id], body) => {
  const proposal = body.proposal as { title: string; description?: string; assigneeId?: string | null };
  const task: PartyTask = { id: nextId('task'), partyId: decodeURIComponent(id), title: proposal.title, description: proposal.description ?? '', assigneeId: proposal.assigneeId ?? undefined, status: 'proposed', version: 1, proposedBy: ME, createdAt: now(), updatedAt: now() };
  store.tasks[task.partyId].push(task);
  return task;
});
route('PATCH', '/parties/([^/]+)/tasks/([^/]+)', async ([, id, taskId], body) => {
  await wait(300);
  const task = store.tasks[decodeURIComponent(id)].find((item) => item.id === decodeURIComponent(taskId))!;
  const action = String(body.action);
  if (action === 'accept' || action === 'claim') { task.status = 'accepted'; task.acceptedVersion = task.version; if (action === 'claim') task.assigneeId = ME; }
  if (action === 'decline') task.status = 'declined';
  if (action === 'complete') task.status = 'completed';
  task.updatedAt = now();
  return task;
});
route('GET', '/parties/([^/]+)/email-invites', () => ({ available: true, sandbox: false, reason: '' }));
route('POST', '/parties/([^/]+)/email-invites', async () => { await wait(700); return { status: 'sent' }; });
route('POST', '/parties/([^/]+)/invites', async () => { await wait(400); return { token: 'sat-trip-7f3k', expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }; });
route('POST', '/invites/([^/]+)/join', () => store.parties[0]);
route('GET', '/parties/([^/]+)/messages', ([, id]) => {
  const partyId = decodeURIComponent(id);
  return { messages: store.messages[partyId] ?? [], runs: store.runs[partyId] ?? [] };
});
route('POST', '/parties/([^/]+)/messages', async ([, id], body) => {
  await wait(220);
  return addMessage(decodeURIComponent(id), ME, String(body.text), String(body.clientId));
});
route('GET', '/parties/([^/]+)/runs/([^/]+)', ([, id, runId]) => store.runs[decodeURIComponent(id)].find((run) => run.id === decodeURIComponent(runId)));

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname.slice(4);
  const body = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) as Record<string, unknown> : {};
  for (const [routeMethod, pattern, handler] of routes) {
    const match = path.match(pattern);
    if (match && routeMethod === method) {
      await wait(60);
      const result = await handler(match, body);
      return result === undefined ? new Response(null, { status: 204 }) : json(result);
    }
  }
  return json({ message: `Demo route missing: ${method} ${path}` }, 404);
};

declare global {
  interface Window { __director: typeof director }
}

const director = {
  scene,
  /** Another member posts a message (instantly, as if it just arrived). */
  post(authorId: string, text: string, partyId = CLASS_ID) { return addMessage(partyId, authorId, text).message.id; },
  setSharing(partyId: string, value: boolean) { store.members[partyId].find((member) => member.userId === ME)!.useSharedMemory = value; emitPartyEvent(); },
  runsDone(partyId: string) { return store.runs[partyId].every((run) => run.status === 'completed'); },
  store,
};
window.__director = director;
