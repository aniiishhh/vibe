import { createHash } from 'node:crypto';
import { SESv2Client, GetAccountCommand, GetEmailIdentityCommand, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { z } from 'zod';
import { AppError, db, getItem, key, membershipCheck, requireParty, tableName, transact } from './store.js';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
const ses = new SESv2Client({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 1 });
const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-2' });
let senderValue: Promise<string> | undefined;
async function sender() {
  if (!process.env.INVITE_SENDER_PARAMETER) return '';
  senderValue ??= ssm.send(new GetParameterCommand({ Name: process.env.INVITE_SENDER_PARAMETER })).then(r=>r.Parameter?.Value ?? '').catch(error=>{ senderValue=undefined; throw error; });
  return senderValue;
}
export async function emailInviteAvailability() {
  const from = await sender();
  if (!from) return { available: false, sandbox: true, reason: 'An email sender needs configuration.' };
  const [account, identity] = await Promise.all([ses.send(new GetAccountCommand({})), ses.send(new GetEmailIdentityCommand({ EmailIdentity: from }))]);
  return { available: account.SendingEnabled === true && identity.VerifiedForSendingStatus === true, sandbox: account.ProductionAccessEnabled !== true,
    reason: identity.VerifiedForSendingStatus ? (account.ProductionAccessEnabled ? '' : 'Sandbox delivery supports verified addresses, the SES mailbox simulator and addresses at verified domains.') : 'The sender verification email still needs confirmation.' };
}
export const emailInviteInput = z.object({ email: z.email().max(254), clientId: z.uuid() }).strict();

export async function sendEmailInvite(partyId: string, userId: string, raw: unknown, createLink: () => Promise<{token:string;expiresAt:string}>) {
  const input = emailInviteInput.parse(raw);
  const party = await requireParty(partyId, userId);
  const actionKey = key(`PARTY#${partyId}`, `EMAIL_INVITE#${userId}#${input.clientId}`);
  const recipientHash = createHash('sha256').update(input.email.toLowerCase()).digest('hex');
  let record = await getItem(String(actionKey.PK), String(actionKey.SK));
  if (record && record.recipientHash !== recipientHash) throw new AppError(409,'ACTION_REUSED','Use a new send ID for a different recipient.');
  if (!record) {
    const availability = await emailInviteAvailability();
    if (!availability.available) throw new AppError(503,'EMAIL_UNAVAILABLE',availability.reason || 'Email sending is unavailable.');
    const invite = await createLink();
    const url = new URL(`/invite/${encodeURIComponent(invite.token)}`, process.env.APP_URL).toString();
    const item = { ...actionKey, entityType: 'EMAIL_INVITE', partyId, recipientHash, url, expiresAt: invite.expiresAt, status: 'prepared', createdAt: new Date().toISOString() };
    try {
      await transact([membershipCheck(partyId,userId), { Put: { TableName: tableName(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } }]);
      record = item;
    } catch(error) { record=await getItem(String(actionKey.PK),String(actionKey.SK)); if(!record)throw error; }
  }
  if (record.recipientHash !== recipientHash) throw new AppError(409,'ACTION_REUSED','Use a new send ID for a different recipient.');
  if (record.status === 'sent') return { status: 'sent', expiresAt: record.expiresAt };
  if (record.status !== 'prepared') return { status: record.status === 'failed' ? 'failed' : 'unknown', reason: 'Check delivery before using a new send ID.' };
  const lease = crypto.randomUUID();
  try {
    await transact([membershipCheck(partyId,userId), { Update: { TableName: tableName(), Key: actionKey,
      UpdateExpression: 'SET #status = :sending, lease = :lease', ConditionExpression: '#status = :prepared',
      ExpressionAttributeNames: { '#status':'status' }, ExpressionAttributeValues:{ ':sending':'sending', ':prepared':'prepared', ':lease':lease } } }]);
  } catch(error) {
    const saved=await getItem(String(actionKey.PK),String(actionKey.SK));
    if(saved?.status==='sent')return {status:'sent',expiresAt:saved.expiresAt};
    if(saved?.status==='sending')return {status:'unknown',reason:'This invite is being sent. Check delivery before sending again.'};
    throw error;
  }
  let status = 'sent';
  try {
    await ses.send(new SendEmailCommand({ FromEmailAddress: `Vibe <${await sender()}>`, Destination: { ToAddresses: [input.email] },
      Content: { Simple: { Subject: { Data: `Join ${party.name} on Vibe` }, Body: { Text: { Data: `You have been invited to collaborate in ${party.name} on Vibe.\n\nSign in or create an account, then join using this link.\n${record.url}\n\nThis link expires ${record.expiresAt}. Anyone with the link can join, so share it with your intended group.` } } } } }), { abortSignal: AbortSignal.timeout(12000) });
  } catch(error) {
    // SES has no send idempotency key. A timeout can follow acceptance by SES.
    // Preserve that uncertainty so retries cannot silently send duplicate messages.
    const code = error instanceof Error ? error.name : '';
    status = ['MessageRejected','MailFromDomainNotVerifiedException','BadRequestException','AccountSuspendedException','SendingPausedException','TooManyRequestsException'].includes(code) ? 'failed' : 'unknown';
  }
  await db.send(new UpdateCommand({ TableName: tableName(), Key: actionKey, UpdateExpression: 'SET #status = :status', ConditionExpression:'lease = :lease',
    ExpressionAttributeNames:{'#status':'status'},ExpressionAttributeValues:{':status':status,':lease':lease} }));
  return { status, expiresAt: record.expiresAt, ...(status==='sent'?{}:{reason:status==='failed'?'SES rejected this invitation. In the sandbox, verify the recipient or use the mailbox simulator.':'Delivery is uncertain. Check the recipient inbox before sending again.'}) };
}
