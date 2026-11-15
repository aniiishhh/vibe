import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationMode, Member, Party, PartyTask, TaskInput } from '@vibe/shared';
import { ChevronDown, ListTodo } from 'lucide-react';
import { errorMessage, type VibeApi } from './api';

export function PartyTasks({ api, party, members, viewerId }: { api: VibeApi; party: Party; members: Member[]; viewerId: string }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ['tasks', party.id], queryFn: () => api.getTasks(party.id), enabled: open, refetchInterval: open ? 10000 : false });
  const refresh = () => client.invalidateQueries({ queryKey: ['tasks', party.id] });
  const [adding, setAdding] = useState(false);
  const create = useMutation({ mutationFn: ({proposal,actionId}: {proposal:TaskInput;actionId:string}) => api.proposeTask(party.id, proposal, actionId), onSuccess: async () => { setAdding(false); await refresh(); } });
  const mode = useMutation({ mutationFn: (value: ConversationMode) => api.updatePartyMode(party.id, value, party.settingsVersion ?? 0), onSuccess: () => client.invalidateQueries({ queryKey: ['party', party.id] }) });
  return <section className={`party-facts${open ? ' party-facts-open' : ''}`}>
    <button className="party-facts-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span><ListTodo size={15} /> Tasks and Vibe mode</span><ChevronDown size={15} /></button>
    {open && <div className="party-facts-body">
      <label>Vibe mode <select aria-label="Vibe mode" value={party.mode ?? 'friendly'} disabled={viewerId !== party.ownerId || mode.isPending} onChange={event => mode.mutate(event.target.value as ConversationMode)}><option value="focused">Focused</option><option value="friendly">Friendly</option><option value="banter">Banter</option></select></label>
      {mode.isError && <p role="alert">{errorMessage(mode.error)} <button type="button" onClick={() => void client.invalidateQueries({queryKey:['party',party.id]})}>Reload settings</button></p>}
      {tasks.isPending ? <p>Loading tasks…</p> : tasks.isError ? <p role="alert">{errorMessage(tasks.error)} <button onClick={() => void tasks.refetch()}>Retry</button></p> : <>
        {!tasks.data?.tasks.length && <p>No tasks yet. Propose one here or ask @Vibe to create a task.</p>}
        <ul className="party-facts-list">{tasks.data?.tasks.map(task => <TaskRow key={task.id} task={task} members={members} viewerId={viewerId} partyOwnerId={party.ownerId} api={api} refresh={refresh} />)}</ul>
      </>}
      {adding ? <TaskForm members={members} pending={create.isPending} onSave={(proposal,actionId) => create.mutate({proposal,actionId})} onCancel={() => setAdding(false)} /> : <button className="button button-secondary" type="button" onClick={() => setAdding(true)}>Propose task</button>}
      {create.isError && <p role="alert">{errorMessage(create.error)}</p>}
    </div>}
  </section>;
}
function TaskRow({ task, members, viewerId, partyOwnerId, api, refresh }: { task: PartyTask; members: Member[]; viewerId: string; partyOwnerId: string; api: VibeApi; refresh: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [editVersion,setEditVersion] = useState(task.version);
  const actionIds = useRef(new Map<string,string>());
  const mutation = useMutation({ mutationFn: ({ action, proposal, actionId }: { action: 'edit'|'accept'|'claim'|'decline'|'complete'; proposal?: TaskInput; actionId?: string }) => {
    const version=action==='edit' ? editVersion : task.version;
    const fingerprint=JSON.stringify([version,action,proposal]);
    const id=actionId ?? actionIds.current.get(fingerprint) ?? crypto.randomUUID();
    actionIds.current.set(fingerprint,id);
    return api.changeTask(task.partyId,task.id,version,action,id,proposal);
  }, onSuccess: async () => { setEditing(false); await refresh(); } });
  const own = task.assigneeId === viewerId;
  return <li><div>
    <strong>{task.title}</strong><p>{task.description}</p>
    <small>{task.status} · {members.find(member => member.userId === task.assigneeId)?.name ?? (task.assigneeId ? 'Former member' : 'Unassigned')} · v{task.version}{task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleString()}` : ''}</small>
    {editing ? <TaskForm initial={task} members={members} pending={mutation.isPending} onCancel={() => setEditing(false)} onSave={(proposal,actionId) => mutation.mutate({action:'edit',proposal,actionId})} /> : <div className="party-note-actions">
      {task.status === 'proposed' && (!task.assigneeId || own) && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({action:own?'accept':'claim'})}>{own?'Accept assignment':'Claim task'}</button>}
      {own && ['proposed','accepted'].includes(task.status) && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({action:'decline'})}>Decline</button>}
      {own && task.status === 'accepted' && <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({action:'complete'})}>Mark complete</button>}
      {[task.proposedBy,partyOwnerId].includes(viewerId) && <button type="button" onClick={() => {setEditVersion(task.version);setEditing(true);}}>Propose revision</button>}
    </div>}
    {mutation.isError && <p role="alert">{errorMessage(mutation.error)} <button type="button" onClick={() => {mutation.reset(); void refresh();}}>Reload tasks</button></p>}
  </div></li>;
}
function TaskForm({ initial, members, pending, onSave, onCancel }: { initial?: TaskInput; members: Member[]; pending: boolean; onSave: (input: TaskInput, actionId: string) => void; onCancel: () => void }) {
  const lastSend = useRef({fingerprint:'',id:''});
  const [title,setTitle] = useState(initial?.title ?? '');
  const [description,setDescription] = useState(initial?.description ?? '');
  const [assigneeId,setAssignee] = useState(initial?.assigneeId ?? '');
  const [dueAt,setDueAt] = useState(initial?.dueAt ? new Date(Date.parse(initial.dueAt)-new Date(initial.dueAt).getTimezoneOffset()*60000).toISOString().slice(0,16) : '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const proposal={title,description,assigneeId:assigneeId || null,dueAt:dueAt ? new Date(dueAt).toISOString() : null};
    const fingerprint=JSON.stringify(proposal);
    if(lastSend.current.fingerprint!==fingerprint)lastSend.current={fingerprint,id:crypto.randomUUID()};
    onSave(proposal,lastSend.current.id);
  };
  return <form className="party-note-form" onSubmit={submit}>
    <label>Task title<input className="text-input" required maxLength={160} value={title} onChange={event=>setTitle(event.target.value)} /></label>
    <label>Details<textarea maxLength={2000} value={description} onChange={event=>setDescription(event.target.value)} /></label>
    <label>Proposed assignee<select value={assigneeId} onChange={event=>setAssignee(event.target.value)}><option value="">Anyone can claim</option>{members.map(member=><option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
    <label>Due date<input className="text-input" type="datetime-local" value={dueAt} onChange={event=>setDueAt(event.target.value)} /></label>
    <p>New assignments and revisions require the assignee’s acceptance.</p>
    <button className="button button-secondary" type="submit" disabled={pending || !title.trim()}>{pending?'Saving…':'Save proposal'}</button><button type="button" onClick={onCancel}>Cancel</button>
  </form>;
}
