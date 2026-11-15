import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, getItem, tableName, type Item } from './store.js';

/** Human sources only. Explicit reply links can recover older proposals within the same budget. */
export async function conversationContext(partyId: string, through: string, excludeIds = new Set<string>(), budget = 12000, limit = 40, referencedIds: string[] = []): Promise<Item[]> {
  if (budget <= 0 || limit <= 0) return [];
  const page = await db.send(new QueryCommand({ TableName: tableName(), ConsistentRead: true, ScanIndexForward: false, Limit: 40,
    KeyConditionExpression: 'PK = :party AND SK BETWEEN :first AND :last',
    ExpressionAttributeValues: { ':party': `PARTY#${partyId}`, ':first': 'MSG#', ':last': `MSG#${through}` } }));
  const rows = (page.Items ?? []).filter(row => row.role === 'user' && typeof row.id === 'string');
  const linked = [...new Set([...referencedIds, ...rows.flatMap(row => typeof row.replyToId === 'string' ? [row.replyToId] : [])])].slice(0,5);
  for (const id of linked) {
    if (id > through || rows.some(row => row.id === id)) continue;
    const row = await getItem(`PARTY#${partyId}`, `MSG#${id}`);
    if (row?.role === 'user' && row.partyId === partyId) rows.unshift(row);
  }
  const selected: Item[] = [];
  let remaining = budget;
  // Linked proposals have priority over unrelated context at the window boundary.
  const ordered = [...rows].sort((a,b) => Number(linked.includes(String(b.id))) - Number(linked.includes(String(a.id))) || String(b.id).localeCompare(String(a.id)));
  for (const row of ordered) {
    if (excludeIds.has(String(row.id)) || selected.length >= limit || remaining <= 0) continue;
    const text = String(row.text ?? '').slice(0, Math.min(2000, remaining));
    remaining -= text.length;
    selected.push({ id: row.id, partyId, authorId: row.authorId, authorName: row.authorName, createdAt: row.createdAt,
      ...(typeof row.replyToId === 'string' ? { replyToId: row.replyToId } : {}), text,
      notesEpochAtCreation: Number(row.notesEpochAtCreation ?? 0) });
  }
  return selected.sort((a,b) => String(a.id).localeCompare(String(b.id)));
}
