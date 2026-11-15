import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getItem, key, membershipCheck, refreshOutboxItem, tableName, transact } from './store.js';
import { notesRevisionUpdate, partySourceSuppressed } from './party-notes.js';

export const participationInput = z.object({
  text: z.string().trim().min(1).max(500),
  responseMessageId: z.string().min(1).max(80),
  proposalMessageIds: z.array(z.string().min(1).max(80)).max(5),
  status: z.enum(['suggested', 'confirmed', 'unresolved', 'withdrawn']),
}).strict();

export async function recordParticipation(partyId: string, triggerAuthorId: string, raw: unknown, epoch: number) {
  const input = participationInput.parse(raw);
  const response = await getItem(`PARTY#${partyId}`, `MSG#${input.responseMessageId}`);
  const meta = await getItem(`PARTY#${partyId}`, 'META');
  if (!response || response.role !== 'user' || response.partyId !== partyId || Number(response.notesEpochAtCreation ?? 0) !== epoch || Number(meta?.notesEpoch ?? 0) !== epoch) return;
  const ownerId = String(response.authorId);
  if (!await getItem(`PARTY#${partyId}`, `MEMBER#${ownerId}`)) return;
  // An explicit reply determines the referenced proposal even if nearby proposals compete.
  if (input.status !== 'unresolved' && !input.proposalMessageIds.length) return;
  const ids = [...new Set([input.responseMessageId, ...input.proposalMessageIds])];
  const authors = new Set([triggerAuthorId, ownerId]);
  for (const id of ids) {
    const source = await getItem(`PARTY#${partyId}`, `MSG#${id}`);
    if (!source || source.role !== 'user' || source.partyId !== partyId || await partySourceSuppressed(partyId, id)) return;
    authors.add(String(source.authorId));
  }
  const anchor = [...input.proposalMessageIds].sort()[0] ?? input.responseMessageId;
  const id = `r_${createHash('sha256').update(`${ownerId}:${anchor}`).digest('hex').slice(0,32)}`;
  const existing = await getItem(`PARTY#${partyId}`, `FACT#${id}`);
  if (response.replyToId && input.status !== 'unresolved' && !input.proposalMessageIds.includes(String(response.replyToId)) && existing?.responseMessageId !== response.replyToId) return;
  if (existing?.deleted || existing?.lastEditorId || String(existing?.responseMessageId ?? '') >= input.responseMessageId) return;
  const now = new Date().toISOString();
  const note = { ...key(`PARTY#${partyId}`, `FACT#${id}`), entityType: 'PARTY_FACT', id,
    kind: 'participation', text: input.text, subjectId: ownerId, subjectName: response.authorName,
    speakerId: ownerId, speakerIds: [...authors], source: 'conversation', sourceMessageIds: ids,
    proposalMessageIds: input.proposalMessageIds, responseMessageId: input.responseMessageId, participationStatus: input.status,
    version: Number(existing?.version ?? 0)+1, createdAt: existing?.createdAt ?? now, updatedAt: now, updatedBy: ownerId };
  await transact([
    ...[...authors].map(author => membershipCheck(partyId, author)),
    notesRevisionUpdate(partyId, Number(meta?.notesRevision ?? 0), false),
    { Put: { TableName: tableName(), Item: note, ConditionExpression: existing ? '#version = :version' : 'attribute_not_exists(PK)',
      ...(existing ? { ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': existing.version } } : {}) } },
    { Put: { TableName: tableName(), Item: refreshOutboxItem(partyId) } },
  ]);
}
