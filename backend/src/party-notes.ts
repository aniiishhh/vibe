import { isAdmin, requireAdmin } from './party-membership.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ulid } from 'ulid';
import type { PartyFact } from '@vibe/shared';
import { AppError, getItem, key, membershipCheck, refreshOutboxItem, requireParty, tableName, transact, type Item } from './store.js';
import { toPublicPartyFact } from './memory-store.js';
export const noteKind = z.enum(['decision', 'suggestion', 'constraint', 'question', 'disagreement', 'preference', 'participation']);
export const createPartyNoteInput = z.object({
    text: z.string().trim().min(1).max(500), kind: noteKind,
    sourceMessageIds: z.array(z.string().min(1).max(80)).max(10).default([]),
    expiresAt: z.string().datetime().optional(),
    topic: z.enum(['interests', 'schedule', 'dietary', 'communication', 'other']).optional(),
    subjectMessageId: z.string().min(1).max(80).optional(),
}).strict();
export const editPartyNoteInput = z.object({
    version: z.number().int().positive(), text: z.string().trim().min(1).max(500), kind: noteKind,
    expiresAt: z.string().datetime().nullable().optional(),
    participationStatus: z.enum(['suggested','confirmed','unresolved','withdrawn']).optional(),
}).strict();
export const deletePartyNoteInput = z.object({ version: z.number().int().positive() }).strict();
export type NoteInput = z.infer<typeof createPartyNoteInput>;
export function noteId(input: NoteInput): string {
    return 'n_' + createHash('sha256').update(JSON.stringify([
        input.kind, input.text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(),
    ])).digest('hex').slice(0, 40);
}
export async function partySourceSuppressed(partyId: string, messageId: string): Promise<boolean> {
    return Boolean(await getItem(`PARTY#${partyId}`, `NOTE_SUPPRESS#${messageId}`));
}
function conflict(): AppError { return new AppError(409, 'PARTY_MEMORY_CONFLICT', 'Party memory changed. Reload the notes and try again.'); }
export function notesRevisionUpdate(partyId: string, revision: number, edited: boolean) {
    return { Update: {
            TableName: tableName(), Key: key(`PARTY#${partyId}`, 'META'),
            UpdateExpression: 'SET notesRevision = :next' + (edited ? ', notesEpoch = if_not_exists(notesEpoch, :zero) + :one' : ''),
            ConditionExpression: 'attribute_exists(PK) AND ' + (revision === 0 ? '(attribute_not_exists(notesRevision) OR notesRevision = :revision)' : 'notesRevision = :revision'),
            ExpressionAttributeValues: { ':revision': revision, ':next': revision + 1, ...(edited ? { ':zero': 0, ':one': 1 } : {}) },
        } };
}
async function sources(partyId: string, ids: string[]): Promise<Item[]> {
    const rows = await Promise.all(ids.map(id => getItem(`PARTY#${partyId}`, `MSG#${id}`)));
    if (rows.some(row => !row || row.role !== 'user' || row.partyId !== partyId))
        throw new AppError(400, 'INVALID_SOURCE', 'Sources must be human messages from this party.');
    return rows as Item[];
}
export async function createPartyNote(partyId: string, userId: string, raw: unknown, extraction?: {
    epoch: number;
}): Promise<PartyFact | undefined> {
    const input = createPartyNoteInput.parse(raw);
    if (input.kind === 'participation') throw new AppError(400, 'INVALID_NOTE_KIND', 'Participation is recorded from sourced responses.');
    if (extraction) await requireParty(partyId, userId);
    else await requireAdmin(partyId, userId);
    const meta = await getItem(`PARTY#${partyId}`, 'META');
    if (!meta)
        throw new AppError(404, 'NOT_FOUND', 'Party not found.');
    const rows = await sources(partyId, [...new Set(input.sourceMessageIds)]);
    if (extraction) {
        if (!rows.length || Number(meta.notesEpoch ?? 0) !== extraction.epoch)
            return;
        if (rows.some(row => Number(row.notesEpochAtCreation ?? 0) !== extraction.epoch))
            return;
        if ((await Promise.all(input.sourceMessageIds.map(id => partySourceSuppressed(partyId, id)))).some(Boolean))
            return;
        // One person's claim that the group agreed is not sufficient evidence of agreement.
        if (input.kind === 'decision' && new Set(rows.map(row => row.authorId)).size < 2)
            input.kind = 'suggestion';
    }
    const subject = input.kind === 'preference' ? rows[0] : undefined;
    if (input.kind === 'preference' && (!extraction || !subject || rows.some(row => row.authorId !== subject.authorId)))
        throw new AppError(400, 'INVALID_SUBJECT', 'Preferences require self-authored source messages.');
    const id = subject ? `p_${createHash('sha256').update(`${subject.authorId}:${input.topic ?? 'other'}`).digest('hex').slice(0, 40)}` : extraction ? noteId(input) : ulid();
    const existing = await getItem(`PARTY#${partyId}`, `FACT#${id}`);
    if (existing && (!subject || existing.deleted || existing.text === input.text))
        return existing.deleted ? undefined : toPublicPartyFact(existing);
    const now = new Date().toISOString();
    const note = { ...key(`PARTY#${partyId}`, `FACT#${id}`), entityType: 'PARTY_FACT', id,
        ...input, ...(subject ? { subjectId: subject.authorId, subjectName: subject.authorName ?? 'Participant', topic: input.topic ?? 'other' } : {}), sourceMessageIds: [...new Set([...(existing?.sourceMessageIds as string[] ?? []), ...input.sourceMessageIds])].slice(-10), speakerId: extraction ? String(rows[0]?.authorId ?? userId) : userId,
        speakerIds: [...new Set(rows.map(row => String(row.authorId)))], source: extraction ? 'conversation' : 'manual',
        version: Number(existing?.version ?? 0) + 1, createdAt: existing?.createdAt ?? now, updatedAt: now, updatedBy: userId };
    const revision = Number(meta.notesRevision ?? 0);
    try {
        await transact([
            membershipCheck(partyId, userId, !extraction), notesRevisionUpdate(partyId, revision, false),
            { Put: { TableName: tableName(), Item: note, ConditionExpression: existing ? '#version = :version' : 'attribute_not_exists(PK)', ...(existing ? { ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': existing.version } } : {}) } },
            { Put: { TableName: tableName(), Item: refreshOutboxItem(partyId) } },
        ]);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'TransactionCanceledException') {
            const retry = await getItem(`PARTY#${partyId}`, `FACT#${id}`);
            if (retry)
                return retry.deleted ? undefined : toPublicPartyFact(retry);
            throw conflict();
        }
        throw error;
    }
    return toPublicPartyFact(note);
}
export async function changePartyNote(partyId: string, userId: string, id: string, raw: unknown, deleted = false): Promise<PartyFact> {
    const input = deleted ? deletePartyNoteInput.parse(raw) : editPartyNoteInput.parse(raw);
    await requireParty(partyId, userId);
    const [current, meta] = await Promise.all([getItem(`PARTY#${partyId}`, `FACT#${id}`), getItem(`PARTY#${partyId}`, 'META')]);
    if (!current || current.entityType !== 'PARTY_FACT' || current.deleted || !meta)
        throw new AppError(404, 'NOT_FOUND', 'Party note not found.');
    if ('participationStatus' in input && current.kind !== 'participation') throw new AppError(400,'INVALID_NOTE_KIND','Participation status applies to participation records.');
    const canonical = toPublicPartyFact(current);
    const ownCorrection = canonical.subjectId === userId;
    const admin = isAdmin(await getItem(`PARTY#${partyId}`, `MEMBER#${userId}`));
    if (canonical.subjectId ? !ownCorrection : !admin)
        throw new AppError(403, 'NOTE_READ_ONLY', 'Only admins can change shared notes. Personal records can be corrected by their subject.');
    if (Number(current.version ?? 1) !== input.version)
        throw conflict();
    if (!deleted && current.kind === 'participation' && 'kind' in input && input.kind !== 'participation') throw new AppError(400, 'INVALID_NOTE_KIND', 'Keep the participation record type when correcting it.');
    const now = new Date().toISOString();
    const next: Item = { ...current, ...canonical, ...input, version: input.version + 1, lastEditorId: userId, updatedAt: now, updatedBy: userId, deleted };
    if ('expiresAt' in input && input.expiresAt === null)
        delete next.expiresAt;
    const sourceIds = Array.isArray(current.sourceMessageIds) ? [...new Set(current.sourceMessageIds as string[])] : [];
    try {
        await transact([
            membershipCheck(partyId, userId, !ownCorrection), notesRevisionUpdate(partyId, Number(meta.notesRevision ?? 0), true),
            { Put: { TableName: tableName(), Item: next, ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(#version) OR #version = :version) AND (attribute_not_exists(#deleted) OR #deleted = :false)', ExpressionAttributeNames: { '#version': 'version', '#deleted': 'deleted' }, ExpressionAttributeValues: { ':version': input.version, ':false': false } } },
            { Put: { TableName: tableName(), Item: { ...key(`PARTY#${partyId}`, `NOTE_HISTORY#${id}#${input.version}`), ...{ previous: current, editedAt: now, editedBy: userId } } } },
            ...sourceIds.map(messageId => ({ Put: { TableName: tableName(), Item: { ...key(`PARTY#${partyId}`, `NOTE_SUPPRESS#${messageId}`), noteId: id, createdAt: now } } })),
            { Put: { TableName: tableName(), Item: refreshOutboxItem(partyId) } },
        ]);
    }
    catch (error) {
        if (error instanceof Error && error.name === 'TransactionCanceledException')
            throw conflict();
        throw error;
    }
    return toPublicPartyFact(next);
}
