import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Member, Party } from '@vibe/shared';
import {
  AppError, getItem, key, membershipCheck, partyMembershipRevisionUpdate, queryItems,
  refreshOutboxItem, requireParty, tableName, toMember, transact, isTransactionCanceled,
} from './store.js';

export function isAdmin(member: { role?: unknown } | undefined): boolean {
  return member?.role === 'owner' || member?.role === 'admin';
}

export async function requireAdmin(partyId: string, userId: string): Promise<void> {
  await requireParty(partyId, userId);
  if (!isAdmin(await getItem(`PARTY#${partyId}`, `MEMBER#${userId}`))) {
    throw new AppError(403, 'ADMIN_REQUIRED', 'Only party admins can do this.');
  }
}

export async function allMembers(partyId: string): Promise<Member[]> {
  const members: Member[] = [];
  let cursor;
  do {
    const page = await queryItems({ PK: `PARTY#${partyId}`, beginsWith: 'MEMBER#', exclusiveStartKey: cursor });
    members.push(...page.items.map(toMember));
    cursor = page.lastEvaluatedKey;
  } while (cursor);
  return members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export async function changeMember(partyId: string, actorId: string, targetId: string, role?: 'admin' | 'member'): Promise<void> {
  await requireParty(partyId, actorId);
  const [meta, actor, target] = await Promise.all([
    getItem(`PARTY#${partyId}`, 'META'),
    getItem(`PARTY#${partyId}`, `MEMBER#${actorId}`),
    getItem(`PARTY#${partyId}`, `MEMBER#${targetId}`),
  ]);
  if (!meta || !actor) throw new AppError(403, 'FORBIDDEN', 'Your party membership changed.');
  if (!target) throw new AppError(404, 'NOT_FOUND', 'Party member not found.');
  const adminAction = role !== undefined || actorId !== targetId;
  if (adminAction && !isAdmin(actor)) throw new AppError(403, 'ADMIN_REQUIRED', 'Only party admins can do this.');
  if (role && (target.role === role || (target.role === 'owner' && role === 'admin'))) return;

  // Read the revision before the member list. Every join, removal and role change
  // compares/increments it, so concurrent changes cannot strand a populated party.
  const losesAdmin = isAdmin(target) && role !== 'admin';
  const others = losesAdmin ? (await allMembers(partyId)).filter(member => member.userId !== targetId) : [];
  const successor = others.find(isAdmin);
  if (losesAdmin && !successor && (others.length > 0 || role !== undefined)) {
    throw new AppError(409, 'LAST_ADMIN', 'Appoint another admin before leaving or removing the last admin role.');
  }
  const revisionUpdate = partyMembershipRevisionUpdate(partyId, Number(meta.membershipRevision ?? 0));
  if (losesAdmin && meta.ownerId === targetId) {
    revisionUpdate.Update.UpdateExpression += ', ownerId = :owner';
    Object.assign(revisionUpdate.Update.ExpressionAttributeValues, { ':owner': successor?.userId ?? '' });
  }
  if (losesAdmin && others.length === 0 && role === undefined) {
    revisionUpdate.Update.UpdateExpression += ', closed = :closed';
    Object.assign(revisionUpdate.Update.ExpressionAttributeValues, { ':closed': true });
  }
  const transaction: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    revisionUpdate,
    { Put: { TableName: tableName(), Item: refreshOutboxItem(partyId) } },
  ];
  // DynamoDB allows only one operation on an item in a transaction.
  if (actorId !== targetId) transaction.push(membershipCheck(partyId, actorId, adminAction));
  if (role === undefined) {
    transaction.push({ Delete: {
      TableName: tableName(), Key: key(`PARTY#${partyId}`, `MEMBER#${targetId}`),
      ConditionExpression: 'attribute_exists(PK)',
    } });
  } else {
    const selfDemotion = actorId === targetId;
    transaction.push({ Update: {
      TableName: tableName(), Key: key(`PARTY#${partyId}`, `MEMBER#${targetId}`),
      UpdateExpression: 'SET #role = :role',
      ConditionExpression: selfDemotion ? 'attribute_exists(PK) AND (#role = :admin OR #role = :owner)' : 'attribute_exists(PK)',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':role': role, ...(selfDemotion ? { ':admin': 'admin', ':owner': 'owner' } : {}) },
    } });
  }
  try {
    await transact(transaction);
  } catch (error) {
    if (isTransactionCanceled(error)) throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Party membership changed. Reload and try again.');
    throw error;
  }
}

export async function archiveParty(partyId: string, userId: string, archived: boolean): Promise<Party> {
  const party = await requireParty(partyId, userId);
  try {
    await transact([{ Update: {
      TableName: tableName(), Key: key(`PARTY#${partyId}`, `MEMBER#${userId}`),
      UpdateExpression: 'SET archived = :archived', ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeValues: { ':archived': archived },
    } }]);
  } catch (error) {
    if (isTransactionCanceled(error)) throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Your party membership changed. Reload and try again.');
    throw error;
  }
  return { ...party, archived };
}
