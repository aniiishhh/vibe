/**
 * Local-only UI preview. Loaded by main.tsx in development when VITE_MOCK=1 or ?mock is in the URL.
 * Uses in-memory sample data and never contacts Cognito, the API or AppSync.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AgentRun, MemoryFact, Member, Message, Party, PartyFact, PartyTask, Profile } from '@vibe/shared';
import { AuthContext, type SignedInUser } from './auth';
import { ApiRequestError, type VibeApi } from './api';

const me: Profile = { id: 'u-me', name: 'Anish Kumar', email: 'anish@example.com', learningEnabled: true, memoryRevision: 3 };
const maya = { id: 'u-maya', name: 'Maya Chen' };
const leo = { id: 'u-leo', name: 'Leo Ramirez' };

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(6, '0')}`;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const wait = (ms = 220 + Math.random() * 180) => new Promise((resolve) => setTimeout(resolve, ms));

const parties: Party[] = [
  { id: 'p-trip', name: 'San Diego road trip', goal: 'Plan a three-day weekend trip in December on a student budget.', ownerId: me.id, createdAt: minutesAgo(3000) },
  { id: 'p-classes', name: 'Spring classes', goal: 'Find CSE classes we can take together next semester.', ownerId: maya.id, createdAt: minutesAgo(2400) },
  { id: 'p-hack', name: 'Sunhacks team', goal: 'Pick a hackathon idea and split the work for the demo.', ownerId: me.id, createdAt: minutesAgo(900) },
  { id: 'p-dinner', name: 'Friday dinner', goal: 'Choose a restaurant everyone can eat at.', ownerId: leo.id, createdAt: minutesAgo(200) },
  { id: 'p-camp', name: 'Camping at Sedona', goal: 'Gear list and campsite for a hike and overnight camp.', ownerId: leo.id, createdAt: minutesAgo(100) },
  { id: 'p-misc', name: 'Roommates', goal: 'House stuff and chores.', ownerId: me.id, createdAt: minutesAgo(50) },
];

const members: Record<string, Member[]> = Object.fromEntries(parties.map((party) => [party.id, [
  { userId: me.id, name: me.name, joinedAt: party.createdAt, role: party.ownerId === me.id ? 'owner' : 'member', useSharedMemory: party.id === 'p-trip' },
  { userId: maya.id, name: maya.name, joinedAt: party.createdAt, role: party.ownerId === maya.id ? 'owner' : 'member' },
  { userId: leo.id, name: leo.name, joinedAt: party.createdAt, role: party.ownerId === leo.id ? 'owner' : 'member' },
] satisfies Member[]]));

function msg(partyId: string, author: { id: string; name: string } | 'vibe', text: string, at: number): Message {
  const isVibe = author === 'vibe';
  return {
    id: nextId('msg'), partyId, text, createdAt: minutesAgo(at),
    authorId: isVibe ? 'vibe' : author.id, authorName: isVibe ? 'Vibe' : author.name, role: isVibe ? 'assistant' : 'user',
  };
}

const messages: Record<string, Message[]> = {
  'p-trip': [
    msg('p-trip', maya, 'Okay so are we actually doing San Diego the weekend of the 12th?', 95),
    msg('p-trip', leo, 'I’m in. I can drive if someone splits gas with me.', 93),
    msg('p-trip', me, 'Same. I’m vegetarian btw, so somewhere with options for dinner.', 90),
    msg('p-trip', maya, '@Vibe can you suggest a rough plan for 3 days under $250 each?', 88),
    msg('p-trip', 'vibe', 'Here’s a plan that fits **about $230 each** for three people:\n\n- **Day 1:** Drive from Tempe (≈5.5 h). Check in near Ocean Beach, sunset at Sunset Cliffs.\n- **Day 2:** Balboa Park in the morning, tacos in Barrio Logan. Several spots there have good vegetarian options for Anish.\n- **Day 3:** La Jolla Cove and the tide pools, then head back by early afternoon.\n\n| Item | Per person |\n| --- | --- |\n| Gas (split 3 ways) | $35 |\n| Lodging, 2 nights | $120 |\n| Food | $65 |\n| Parking and extras | $10 |\n\nWant me to look for actual places to stay?', 87),
    msg('p-trip', leo, 'That works. Can we do a beach day instead of the park though', 40),
  ],
  'p-classes': [
    msg('p-classes', maya, 'I still need CSE 330 and one elective', 300),
    msg('p-classes', me, 'I prefer morning classes if possible, my afternoons are work shifts.', 290),
  ],
  'p-hack': [
    msg('p-hack', me, 'Idea: group chat where the AI remembers what each of us likes.', 400),
    msg('p-hack', leo, 'Love it. I can take the frontend.', 395),
  ],
  'p-dinner': [],
  'p-camp': [msg('p-camp', leo, 'Who has a tent that fits 3?', 60)],
  'p-misc': [msg('p-misc', maya, 'Trash goes out Thursday!', 30)],
};

const runs: Record<string, AgentRun[]> = Object.fromEntries(parties.map((party) => [party.id, []]));

const partyFacts: Record<string, PartyFact[]> = {
  'p-trip': [
    { id: 'f1', text: 'Trip is the weekend of December 12.', speakerId: maya.id, sourceMessageIds: [messages['p-trip'][0].id], createdAt: minutesAgo(90) },
    { id: 'f2', text: 'Leo will drive; gas is split three ways.', speakerId: leo.id, sourceMessageIds: [messages['p-trip'][1].id], createdAt: minutesAgo(90) },
  ],
};

let memories: MemoryFact[] = [
  { id: 'm1', ownerId: me.id, text: 'I’m vegetarian.', category: 'Food', version: 2, approval: 'approved', approvedVersion: 2, source: 'conversation', sourcePartyId: 'p-trip', sourceMessageIds: [messages['p-trip'][2].id], createdAt: minutesAgo(90), updatedAt: minutesAgo(80), syncState: 'synced' },
  { id: 'm2', ownerId: me.id, text: 'I prefer morning classes.', category: 'Academics', version: 1, approval: 'candidate', source: 'conversation', sourcePartyId: 'p-classes', sourceMessageIds: [messages['p-classes'][1].id], createdAt: minutesAgo(290), updatedAt: minutesAgo(290), syncState: 'synced' },
  { id: 'm3', ownerId: me.id, text: 'Explain things with short examples first.', category: 'Communication', version: 1, approval: 'private', source: 'manual', createdAt: minutesAgo(600), updatedAt: minutesAgo(600), syncState: 'processing' },
];

function requireParty(partyId: string) {
  const party = parties.find((item) => item.id === partyId);
  if (!party) throw new ApiRequestError('This party is not available.', 404);
  return party;
}

const cannedReplies: Record<string, string> = {
  'p-trip': 'Swapping Balboa Park for a beach day works. **Pacific Beach** is close to Ocean Beach and parking is easier before 10 AM. Everything else in the plan stays the same.',
  'p-classes': 'I’ll check spring sections for **CSE 330** with morning meeting times once course search is connected. For now, tell me which electives you’re both considering.',
  default: 'Got it. Here’s a quick summary of what everyone has said so far, plus one question to settle before you decide.',
};

function scheduleRun(partyId: string, run: AgentRun) {
  setTimeout(() => { run.status = 'thinking'; }, 900);
  setTimeout(() => {
    const reply = msg(partyId, 'vibe', cannedReplies[partyId] ?? cannedReplies.default, 0);
    reply.runId = run.id;
    messages[partyId].push(reply);
    run.status = 'completed';
    run.replyMessageId = reply.id;
  }, 9000);
}

export function createMockApi(): VibeApi {
  const tasks: Record<string, PartyTask[]> = {};
  const actions = new Map<string, PartyTask>();
  const api: VibeApi = {
    getTasks: async id => { await wait(); return {tasks:(tasks[id] ?? []).map(task=>({...task}))}; },
    proposeTask: async (id,proposal,actionId) => {
      await wait(); const actionKey=`${id}:${actionId}`;
      if(actions.has(actionKey))return {...actions.get(actionKey)!};
      const now=new Date().toISOString();
      const task:PartyTask={...proposal,description:proposal.description ?? '',assigneeId:proposal.assigneeId ?? undefined,dueAt:proposal.dueAt ?? undefined,id:nextId('task'),partyId:id,status:'proposed',version:1,proposedBy:me.id,createdAt:now,updatedAt:now};
      (tasks[id] ??= []).push(task);actions.set(actionKey,{...task});return {...task};
    },
    changeTask: async (id,taskId,version,action,actionId,proposal) => {
      await wait();const actionKey=`${id}:${actionId}`;
      if(actions.has(actionKey))return {...actions.get(actionKey)!};
      const task=tasks[id]?.find(row=>row.id===taskId);
      if(!task)throw new ApiRequestError('Task not found',404);
      if(task.version!==version)throw new ApiRequestError('Task changed. Reload and try again.',409);
      if(action==='edit'){
        if(!proposal)throw new ApiRequestError('Provide a proposal',400);
        Object.assign(task,proposal,{assigneeId:proposal.assigneeId ?? undefined,dueAt:proposal.dueAt ?? undefined,status:'proposed',acceptedVersion:undefined});
      }else{
        if(task.assigneeId && task.assigneeId!==me.id)throw new ApiRequestError('Only your assignment can be changed',403);
        if(action==='claim'||action==='accept'){
          if(task.status!=='proposed')throw new ApiRequestError('Task requires a new proposal',409);
          Object.assign(task,{assigneeId:me.id,status:'accepted',acceptedVersion:version+1});
        }else if(action==='complete'&&task.status==='accepted')task.status='completed';
        else if(action==='decline'&&task.assigneeId===me.id)task.status='declined';
        else throw new ApiRequestError('Action unavailable',409);
      }
      task.version++;task.updatedAt=new Date().toISOString();actions.set(actionKey,{...task});return {...task};
    },
    updatePartyMode: async (id,mode,version) => {await wait();const party=requireParty(id);if(party.ownerId!==me.id)throw new ApiRequestError('Only the party owner can change the mode',403);if((party.settingsVersion??0)!==version)throw new ApiRequestError('Settings changed',409);party.mode=mode;party.settingsVersion=version+1;return {...party};},
    emailInviteStatus: async () => ({available:false,sandbox:true,reason:'Local preview does not send email. Use the deployed app for invitations.'}),
    sendEmailInvite: async () => {throw new ApiRequestError('Email sending is unavailable in local preview',503);},
    getOwnerProfile: async () => {await wait();return {revision:me.memoryRevision??0,providerStatus:'canonical',checkedAt:new Date().toISOString(),truncated:false,buckets:[...new Set(memories.map(point=>point.category))].map(category=>({category,points:memories.filter(point=>point.category===category&&!point.deleted).map(point=>({id:point.id,text:point.text,approval:point.approval}))}))};},
    createPartyFact: async (id,input) => {await wait();const fact:PartyFact={...input,id:nextId('note'),version:1,source:'manual',speakerId:me.id,sourceMessageIds:[],createdAt:new Date().toISOString()};(partyFacts[id]??=[]).push(fact);return {...fact};},
    updatePartyFact: async (id,factId,input) => {await wait();const fact=partyFacts[id]?.find(point=>point.id===factId);if(!fact)throw new ApiRequestError('Note not found',404);if((fact.version??1)!==input.version)throw new ApiRequestError('Note changed',409);Object.assign(fact,input,{version:input.version+1,updatedAt:new Date().toISOString()});return {...fact};},
    deletePartyFact: async (id,factId,version) => {await wait();const fact=partyFacts[id]?.find(point=>point.id===factId);if(!fact)throw new ApiRequestError('Note not found',404);if((fact.version??1)!==version)throw new ApiRequestError('Note changed',409);partyFacts[id]=partyFacts[id].filter(point=>point.id!==factId);return fact;},
    getProfile: async () => { await wait(); return { ...me }; },
    updateProfile: async (body: { name?: string; learningEnabled?: boolean }) => { await wait(); Object.assign(me, body); return { ...me }; },
    getMemories: async () => {
      await wait();
      const active = memories.filter((item) => !item.deleted);
      return { memories: active, memoryRevision: me.memoryRevision ?? 0, profilePreview: active.filter((item) => item.approval === 'approved').map((item) => `- ${item.text}`).join('\n') };
    },
    createMemory: async (body: { text: string; category?: string; expiresAt?: string; approved?: boolean }) => {
      await wait();
      const fact: MemoryFact = { id: nextId('mem'), ownerId: me.id, text: body.text, category: body.category ?? 'General', version: 1, approval: body.approved ? 'approved' : 'private', source: 'manual', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), expiresAt: body.expiresAt, syncState: 'synced' };
      memories = [fact, ...memories];
      return fact;
    },
    updateMemory: async (id: string, body: { version: number; text?: string; category?: string; expiresAt?: string | null; approved?: boolean }) => {
      await wait();
      const fact = memories.find((item) => item.id === id);
      if (!fact) throw new ApiRequestError('Not found', 404);
      if (body.text !== undefined) fact.text = body.text;
      if (body.category !== undefined) fact.category = body.category;
      if (body.expiresAt !== undefined) fact.expiresAt = body.expiresAt ?? undefined;
      if (body.approved !== undefined) fact.approval = body.approved ? 'approved' : 'private';
      fact.version += 1;
      return { ...fact };
    },
    deleteMemory: async (id: string) => {
      await wait();
      memories = memories.filter((item) => item.id !== id);
      return { id } as MemoryFact;
    },
    exportMemories: async () => { await wait(); return memories.map((item) => `- ${item.text}`).join('\n'); },
    listParties: async () => { await wait(); return { parties: [...parties].reverse() }; },
    createParty: async (body: { name: string; goal: string }) => {
      await wait();
      const party: Party = { id: nextId('p'), name: body.name, goal: body.goal, ownerId: me.id, createdAt: new Date().toISOString() };
      parties.push(party);
      members[party.id] = [{ userId: me.id, name: me.name, joinedAt: party.createdAt, role: 'owner' }];
      messages[party.id] = [];
      runs[party.id] = [];
      return party;
    },
    getParty: async (partyId: string) => { await wait(); return { ...requireParty(partyId) }; },
    getMembers: async (partyId: string) => { await wait(); requireParty(partyId); return { members: members[partyId].map((item) => ({ ...item })) }; },
    updatePartyMemorySharing: async (partyId: string, useSharedMemory: boolean) => {
      await wait();
      const member = members[partyId].find((item) => item.userId === me.id)!;
      member.useSharedMemory = useSharedMemory;
      return { ...member };
    },
    getPartyFacts: async (partyId: string) => { await wait(); return { facts: partyFacts[partyId] ?? [] }; },
    removeMember: async (partyId: string, userId: string) => { await wait(); members[partyId] = members[partyId].filter((item) => item.userId !== userId); },
    createInvite: async () => { await wait(); return { token: 'preview-invite-token', expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }; },
    joinInvite: async () => { await wait(); return parties[0]; },
    getMessages: async (partyId: string) => {
      await wait();
      requireParty(partyId);
      return { messages: messages[partyId].map((item) => ({ ...item })), runs: runs[partyId].map((item) => ({ ...item })) };
    },
    sendMessage: async (partyId: string, body: { text: string; clientId: string; replyToId?: string }) => {
      await wait(450);
      const message = msg(partyId, { id: me.id, name: me.name }, body.text, 0);
      if(body.replyToId)message.replyToId=body.replyToId;
      messages[partyId].push(message);
      let run: AgentRun | undefined;
      if (/@vibe\b/i.test(body.text)) {
        run = { id: nextId('run'), partyId, triggerMessageId: message.id, status: 'queued', createdAt: message.createdAt };
        runs[partyId].push(run);
        scheduleRun(partyId, run);
      }
      return { message: { ...message }, run: run && { ...run } };
    },
    getRun: async (partyId: string, runId: string) => { await wait(); return { ...runs[partyId].find((item) => item.id === runId)! }; },
  };
  return api;
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SignedInUser | null>({ id: me.id, username: me.email });
  const refresh = useCallback(async () => {}, []);
  const signOut = useCallback(async () => { queryClient.clear(); setUser(null); }, [queryClient]);
  const mockSignIn = useCallback(() => setUser({ id: me.id, username: me.email }), []);
  const value = useMemo(() => ({ user, ready: true, refresh, signOut, mockSignIn }), [user, refresh, signOut, mockSignIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
