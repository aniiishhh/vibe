import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PartyTask } from '@vibe/shared';
import { AppError, getItem, key, membershipCheck, queryItems, refreshOutboxItem, requireParty, tableName, transact } from './store.js';

export const taskInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  assigneeId: z.string().min(1).max(200).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).strict();
export const taskMutation = z.object({
  actionId: z.string().min(1).max(160), version: z.number().int().positive(),
  action: z.enum(['edit', 'accept', 'claim', 'decline', 'complete']),
  proposal: taskInput.optional(),
}).strict();

function conflict() { return new AppError(409, 'TASK_CONFLICT', 'This task changed. Reload it and try again.'); }
export function transitionTask(task: PartyTask, actorId: string, ownerId: string, input: z.infer<typeof taskMutation>): PartyTask {
  if (task.version !== input.version) throw conflict();
  const next = { ...task, version: task.version + 1, updatedAt: new Date().toISOString() };
  if (input.action === 'edit') {
    if (actorId !== task.proposedBy && actorId !== ownerId) throw new AppError(403, 'TASK_FORBIDDEN', 'Only the proposer or party owner can revise this task.');
    if (!input.proposal) throw new AppError(400, 'TASK_PROPOSAL_REQUIRED', 'Provide the revised task.');
    return { ...next, ...input.proposal, assigneeId: input.proposal.assigneeId ?? undefined, dueAt: input.proposal.dueAt ?? undefined, status: 'proposed', acceptedVersion: undefined };
  }
  if (input.proposal) throw new AppError(400, 'INVALID_TASK_ACTION', 'Task details require an edit proposal.');
  if (input.action === 'claim' || input.action === 'accept') {
    if (task.status !== 'proposed' || task.assigneeId && task.assigneeId !== actorId) throw new AppError(403, 'TASK_FORBIDDEN', 'Only the proposed assignee can accept. Unassigned tasks can be claimed.');
    return { ...next, assigneeId: actorId, status: 'accepted', acceptedVersion: next.version };
  }
  if (task.assigneeId !== actorId) throw new AppError(403, 'TASK_FORBIDDEN', 'Only your own assignment can be changed.');
  if (input.action === 'decline' && ['proposed', 'accepted'].includes(task.status)) return { ...next, status: 'declined', acceptedVersion: undefined };
  if (input.action === 'complete' && task.status === 'accepted' && task.acceptedVersion === task.version) return { ...next, status: 'completed' };
  throw new AppError(409, 'TASK_STATE', 'This action is unavailable in the current task state.');
}

export async function listTasks(partyId: string, actorId: string): Promise<PartyTask[]> {
  await requireParty(partyId, actorId);
  const tasks: PartyTask[] = [];
  let cursor;
  do {
    const page = await queryItems({ PK: `PARTY#${partyId}`, beginsWith: 'TASK#', consistentRead: true, limit: 100, exclusiveStartKey: cursor });
    tasks.push(...page.items.map(row => row.task as PartyTask));
    cursor = page.lastEvaluatedKey;
  } while (cursor);
  return tasks;
}

export async function mutateTask(partyId: string, actorId: string, raw: unknown, taskId?: string): Promise<PartyTask> {
  const party = await requireParty(partyId, actorId);
  const input = taskId ? taskMutation.parse(raw) : z.object({ actionId: z.string().min(1).max(160), proposal: taskInput }).strict().parse(raw);
  const digest = createHash('sha256').update(JSON.stringify([taskId ?? null, input])).digest('hex');
  const actionKey = key(`PARTY#${partyId}`, `TASK_ACTION#${actorId}#${input.actionId}`);
  const replay = await getItem(String(actionKey.PK), String(actionKey.SK));
  if (replay) {
    if (replay.digest !== digest) throw new AppError(409, 'ACTION_REUSED', 'Use a new action ID for a different task change.');
    return replay.result as PartyTask;
  }
  const now = new Date().toISOString();
  let previous: PartyTask | undefined;
  let task: PartyTask;
  if (taskId) {
    previous = (await getItem(`PARTY#${partyId}`, `TASK#${taskId}`))?.task as PartyTask | undefined;
    if (!previous) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
    task = transitionTask(previous, actorId, party.ownerId, input as z.infer<typeof taskMutation>);
  } else {
    const proposal = input.proposal!;
    task = { id: `t_${createHash('sha256').update(`${actorId}:${input.actionId}`).digest('hex').slice(0,32)}`, partyId,
      ...proposal, assigneeId: proposal.assigneeId ?? undefined, dueAt: proposal.dueAt ?? undefined,
      status: 'proposed', version: 1, proposedBy: actorId, createdAt: now, updatedAt: now };
  }
  const assigneeCheck = task.assigneeId && task.assigneeId !== actorId ? [membershipCheck(partyId, task.assigneeId)] : [];
  const taskKey = key(`PARTY#${partyId}`, `TASK#${task.id}`);
  try {
    await transact([
      membershipCheck(partyId, actorId), ...assigneeCheck,
      { Put: { TableName: tableName(), Item: { ...taskKey, entityType: 'TASK', task, version: task.version },
        ConditionExpression: previous ? '#version = :version' : 'attribute_not_exists(PK)',
        ...(previous ? { ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': previous.version } } : {}) } },
      { Put: { TableName: tableName(), Item: { ...actionKey, entityType: 'TASK_ACTION', digest, result: task, createdAt: now }, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: tableName(), Item: { ...key(`PARTY#${partyId}`, `TASK_HISTORY#${task.id}#${String(task.version).padStart(8,'0')}`), entityType: 'TASK_REVISION', task, actorId, action: taskId ? (input as z.infer<typeof taskMutation>).action : 'propose', createdAt: now } } },
      { Put: { TableName: tableName(), Item: refreshOutboxItem(partyId) } },
    ]);
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TransactionCanceledException') throw error;
    const saved = await getItem(String(actionKey.PK), String(actionKey.SK));
    if (saved?.digest === digest) return saved.result as PartyTask;
    throw conflict();
  }
  return task;
}

export async function proposeTaskFromAgent(context: { partyId: string; authorId: string; runId: string }, name: string, input: unknown) {
  const changeSchema = z.object({ taskId: z.string().min(1).max(80), version: z.number().int().positive(), proposal: taskInput }).strict();
  const parsed = name === 'propose_task' ? taskInput.parse(input) : changeSchema.parse(input);
  const actionId = createHash('sha256').update(JSON.stringify([context.runId, name, parsed])).digest('hex');
  if (name === 'propose_task') return mutateTask(context.partyId, context.authorId, { actionId, proposal: parsed });
  const change = changeSchema.parse(parsed);
  return mutateTask(context.partyId, context.authorId, { actionId, version: change.version, action: 'edit', proposal: change.proposal }, change.taskId);
}
