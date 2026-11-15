import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartyTask } from '@vibe/shared';
const state = vi.hoisted(() => ({ rows: new Map<string, any>() }));
const mocks = vi.hoisted(() => ({
  AppError: class extends Error { constructor(readonly statusCode:number,readonly code:string,message:string){super(message);} },
  db:{send:vi.fn()}, getItem:vi.fn(), queryItems:vi.fn(), transact:vi.fn(),
  key:(PK:string,SK:string)=>({PK,SK}), tableName:()=> 'test', toMember:vi.fn(),
  membershipCheck:vi.fn((partyId:string,userId:string)=>({ConditionCheck:{Key:{PK:`PARTY#${partyId}`,SK:`MEMBER#${userId}`}}})),
  refreshOutboxItem:()=>({PK:'OUTBOX#refresh',SK:'META'}),
  makeOutboxItem:(type:string,partyId:string,payload:unknown)=>({PK:'OUTBOX#job',SK:'META',type,partyId,payload}),
  requireParty:vi.fn(),
}));
vi.mock('../src/store.js',()=>mocks);
import { transitionTask, mutateTask } from '../src/tasks.js';
import { recordParticipation } from '../src/participation.js';
import { scheduleBackgroundMemory, recordPendingMessage } from '../src/background-memory.js';
import { conversationContext } from '../src/conversation-context.js';
function put(SK:string,fields:Record<string,unknown>){const row={PK:'PARTY#p',SK,...fields};state.rows.set(`PARTY#p/${SK}`,row);return row;}
const task:PartyTask={id:'task',partyId:'p',title:'Bring tent',description:'Two person tent',version:1,status:'proposed',assigneeId:'b',proposedBy:'a',createdAt:'2026-11-15T00:00:00Z',updatedAt:'2026-11-15T00:00:00Z'};
beforeEach(()=>{
 vi.clearAllMocks();state.rows.clear();
 put('META',{ownerId:'a',notesEpoch:0,notesRevision:0});
 for(const user of ['a','b'])put(`MEMBER#${user}`,{userId:user});
 mocks.requireParty.mockResolvedValue({id:'p',ownerId:'a'});
 mocks.getItem.mockImplementation(async(PK,SK)=>state.rows.get(`${PK}/${SK}`));
 mocks.db.send.mockResolvedValue({Items:[]});
 mocks.queryItems.mockResolvedValue({items:[]});
 mocks.transact.mockImplementation(async actions=>{for(const action of actions)if(action.Put)state.rows.set(`${action.Put.Item.PK}/${action.Put.Item.SK}`,action.Put.Item);});
});
describe('versioned task actions',()=>{
 it('requires the assignee to accept and complete their current assignment',()=>{
  expect(()=>transitionTask(task,'a','a',{actionId:'1',version:1,action:'accept'})).toThrow('assignee');
  const accepted=transitionTask(task,'b','a',{actionId:'2',version:1,action:'accept'});
  expect(accepted).toMatchObject({status:'accepted',version:2,acceptedVersion:2});
  expect(()=>transitionTask(accepted,'a','a',{actionId:'3',version:2,action:'complete'})).toThrow('own assignment');
  expect(transitionTask(accepted,'b','a',{actionId:'4',version:2,action:'complete'}).status).toBe('completed');
 });
 it('requires renewed acceptance after every proposed material revision',()=>{
  const accepted=transitionTask(task,'b','a',{actionId:'2',version:1,action:'accept'});
  const edited=transitionTask(accepted,'a','a',{actionId:'3',version:2,action:'edit',proposal:{title:'Bring larger tent',description:'Four person tent'}});
  expect(edited).toMatchObject({status:'proposed',version:3});
  expect(edited.acceptedVersion).toBeUndefined();
  expect(()=>transitionTask(edited,'b','a',{actionId:'4',version:3,action:'complete'})).toThrow();
  expect(()=>transitionTask(edited,'b','a',{actionId:'5',version:2,action:'accept'})).toThrow('Reload');
 });
 it('supports unassigned claims and only assigned members can decline',()=>{
  const unassigned={...task,assigneeId:undefined};
  expect(transitionTask(unassigned,'b','a',{actionId:'1',version:1,action:'claim'}).assigneeId).toBe('b');
  expect(()=>transitionTask(task,'a','a',{actionId:'2',version:1,action:'decline'})).toThrow();
  expect(transitionTask(task,'b','a',{actionId:'3',version:1,action:'decline'}).status).toBe('declined');
 });
 it('replays recorded actions and rejects action-ID reuse with other content',async()=>{
  const input={actionId:'same',proposal:{title:'Bring tent',assigneeId:'b'}};
  const first=await mutateTask('p','a',input);
  expect(await mutateTask('p','a',input)).toEqual(first);
  expect(mocks.transact).toHaveBeenCalledTimes(1);
  await expect(mutateTask('p','a',{...input,proposal:{title:'Other task'}})).rejects.toThrow('new action ID');
  const actions=mocks.transact.mock.calls[0][0];
  expect(actions.some((action:any)=>action.ConditionCheck?.Key.SK==='MEMBER#b')).toBe(true);
  expect([...state.rows.keys()].some(key=>key.includes('TASK_HISTORY#'))).toBe(true);
 });
});
describe('contextual participation sources',()=>{
 function sources(){
  put('MSG#001',{id:'001',partyId:'p',role:'user',authorId:'a',authorName:'A',text:'Camping?',notesEpochAtCreation:0});
  put('MSG#002',{id:'002',partyId:'p',role:'user',authorId:'b',authorName:'B',text:"I'm in",replyToId:'001',notesEpochAtCreation:0});
 }
 it('derives the participant from their own response and records proposal sources',async()=>{
  sources();
  await recordParticipation('p','a',{text:'B is joining camping',responseMessageId:'002',proposalMessageIds:['001'],status:'confirmed'},0);
  const row=[...state.rows.values()].find(row=>row.kind==='participation');
  expect(row).toMatchObject({subjectId:'b',participationStatus:'confirmed',sourceMessageIds:['002','001']});
 });
 it('retains a withdrawal and suppresses an older delayed confirmation',async()=>{
  sources();
  const input={text:'B is joining camping',responseMessageId:'002',proposalMessageIds:['001'],status:'confirmed'};
  await recordParticipation('p','a',input,0);
  put('MSG#003',{id:'003',partyId:'p',role:'user',authorId:'b',authorName:'B',text:'I cannot go',replyToId:'002',notesEpochAtCreation:0});
  await recordParticipation('p','a',{...input,text:'B withdrew',responseMessageId:'003',status:'withdrawn'},0);
  await recordParticipation('p','a',input,0);
  expect([...state.rows.values()].filter(row=>row.kind==='participation')).toHaveLength(1);
  expect([...state.rows.values()].find(row=>row.kind==='participation').participationStatus).toBe('withdrawn');
 });
 it('rejects a mismatched explicit reply, removed source authors and stale epochs',async()=>{
  sources();
  put('MSG#000',{id:'000',partyId:'p',role:'user',authorId:'a'});
  await recordParticipation('p','a',{text:'Wrong proposal',responseMessageId:'002',proposalMessageIds:['000'],status:'confirmed'},0);
  state.rows.delete('PARTY#p/MEMBER#b');
  await recordParticipation('p','a',{text:'Removed author',responseMessageId:'002',proposalMessageIds:['001'],status:'confirmed'},0);
  await recordParticipation('p','a',{text:'Old job',responseMessageId:'002',proposalMessageIds:['001'],status:'confirmed'},1);
  expect(mocks.transact).not.toHaveBeenCalled();
 });
 it('preserves unresolved competing proposals as an explicit state',async()=>{
  sources();state.rows.get('PARTY#p/MSG#002').replyToId=undefined;
  put('MSG#000',{id:'000',partyId:'p',role:'user',authorId:'a'});
  await recordParticipation('p','a',{text:'Which activity does B mean?',responseMessageId:'002',proposalMessageIds:['000','001'],status:'unresolved'},0);
  expect([...state.rows.values()].find(row=>row.kind==='participation').participationStatus).toBe('unresolved');
 });
 it('loads an older explicitly linked proposal inside the 40-message budget',async()=>{
  sources();
  mocks.db.send.mockResolvedValue({Items:[state.rows.get('PARTY#p/MSG#002')]});
  const context=await conversationContext('p','002',new Set(),100,40);
  expect(context.map(row=>row.id)).toEqual(['001','002']);
  expect(context.reduce((n,row)=>n+String(row.text).length,0)).toBeLessThanOrEqual(100);
 });
});
describe('idle discovery and rate guards',()=>{
 it('records a discovery marker and author marker with monotonic boundaries',async()=>{
  await recordPendingMessage({id:'002',partyId:'p',authorId:'b',role:'user',createdAt:'2026-11-15T10:00:00.000Z',memoryLearningEnabledAtCreation:true});
  expect(mocks.db.send).toHaveBeenCalledTimes(2);
  const inputs=mocks.db.send.mock.calls.map(call=>call[0].input);
  expect(inputs[0].Key.SK).toBe('LEARN_PENDING#b');
  expect(inputs[1].ExpressionAttributeValues[':due']).toBe('2026-11-15T10:02:00.000Z#p');
  expect(inputs.every(input=>input.ConditionExpression.includes('lastMessageId < :message'))).toBe(true);
 });
 it('claims at most one party batch per five minutes with a persisted usage counter',async()=>{
  process.env.METERED_FEATURES_ENABLED='true';
  const row={PK:'MEMORY_PENDING',SK:'PARTY#p',partyId:'p',lastMessageId:'002',lastActivityAt:'2026-11-15T10:00:00.000Z'};
  state.rows.set('MEMORY_PENDING/PARTY#p',row);mocks.db.send.mockResolvedValue({Items:[row]});
  await scheduleBackgroundMemory(new Date('2026-11-15T10:05:00.000Z'));
  const actions=mocks.transact.mock.calls[0][0];
  expect(actions[1].Update.ConditionExpression).toContain('lastBackgroundAt <= :before');
  expect(actions[1].Update.UpdateExpression).toContain('backgroundBatchCount');
  expect(actions[2].Put.Item.payload).toMatchObject({background:true,force:true,triggerMessageId:'002'});
  expect(actions[0].Update.ExpressionAttributeValues[':due']).toBe('2026-11-15T10:10:00.000Z#p');
 });
 it('skips recent activity and disabled metered features',async()=>{
  process.env.METERED_FEATURES_ENABLED='true';
  const row={PK:'MEMORY_PENDING',SK:'PARTY#p',partyId:'p',lastMessageId:'002',lastActivityAt:'2026-11-15T10:04:00.000Z'};
  state.rows.set('MEMORY_PENDING/PARTY#p',row);mocks.db.send.mockResolvedValue({Items:[row]});
  await scheduleBackgroundMemory(new Date('2026-11-15T10:05:00.000Z'));
  process.env.METERED_FEATURES_ENABLED='false';
  await scheduleBackgroundMemory(new Date('2026-11-15T10:10:00.000Z'));
  expect(mocks.transact).not.toHaveBeenCalled();
 });
});
