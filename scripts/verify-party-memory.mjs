/* Live Milestone 3 integration smoke test. Uses only synthetic accounts and fixture records.
 * Node 24: AWS_PROFILE=vibe-dev AWS_REGION=us-east-2 VIBE_URL=https://... node --env-file=.env scripts/verify-party-memory.mjs
 * All generated credentials are private temporary files; fixture cleanup runs in finally.
 */
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Supermemory } from 'supermemory';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const site = process.env.VIBE_URL;
if (!site) throw new Error('VIBE_URL is required');
const region = process.env.AWS_REGION || 'us-east-2';
const profile = process.env.AWS_PROFILE || 'vibe-dev';
const directory = mkdtempSync(join(tmpdir(), 'vibe-m3-tests-'));
const users = [], parties = [];
let config;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function aws(service, operation, input) {
  const file = join(directory, 'request.json');
  writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
  try {
    const result = execFileSync('aws', [service, operation, '--cli-input-json', `file://${file}`, '--profile', profile, '--region', region, '--output', 'json'], { encoding: 'utf8', stdio: 'pipe', timeout: 30000 });
    return result.trim() ? JSON.parse(result) : {};
  } catch { throw new Error(`AWS ${service}/${operation} failed (credentials and response hidden).`); }
}
async function api(token, path, method = 'GET', body, expectedStatus) {
  const response = await fetch(new URL(config.apiUrl.replace(/\/$/, '') + path, site), {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (expectedStatus !== undefined) { assert(response.status === expectedStatus, `Expected ${expectedStatus}, received ${response.status} (${data.code ?? 'unknown'}).`); return data; }
  assert(response.ok, `API ${method} ${path} failed: ${response.status} (${data.code ?? 'unknown'}).`);
  return data;
}
async function createUser(label) {
  const email = `vibe-m3-${randomUUID()}-${label.toLowerCase()}@example.com`;
  const password = `Vibe!${randomUUID()}aA9`;
  const created = aws('cognito-idp', 'admin-create-user', { UserPoolId: config.userPoolId, Username: email,
    MessageAction: 'SUPPRESS', UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }, { Name: 'name', Value: `Test ${label}` }] });
  const user = { username: created.User.Username, email, password };
  users.push(user);
  aws('cognito-idp', 'admin-set-user-password', { UserPoolId: config.userPoolId, Username: user.username, Password: password, Permanent: true });
  const auth = aws('cognito-idp', 'initiate-auth', { ClientId: config.userPoolClientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
  user.token = auth.AuthenticationResult.IdToken;
  user.id = (await api(user.token, '/me')).id;
  return user;
}
async function waitFor(check, label, milliseconds = 120000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { const result = await check(); if (result) return result; await delay(2000); }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function mention(user, party, text) {
  const sent = await api(user.token, `/parties/${party.id}/messages`, 'POST', { text, clientId: randomUUID() });
  assert(sent.run?.id, 'Mention did not create a run.');
  const page = await waitFor(async () => {
    const page = await api(user.token, `/parties/${party.id}/messages`);
    const run = page.runs.find(r => r.id === sent.run.id);
    if (run?.status === 'failed') throw new Error(`Agent run failed: ${run.error}`);
    return run?.status === 'completed' ? page : undefined;
  }, 'persisted AI reply');
  return { sent, page };
}
function completedTools(party, runId) {
  const names = new Set();
  for (const attempt of [0,1]) {
    const row = aws('dynamodb','get-item',{TableName:'vibe-dev',Key:{PK:{S:`PARTY#${party.id}`},SK:{S:`RESEARCH#${runId}#${attempt}`}}}).Item;
    if (!row) continue;
    const messages = unmarshall(row).state.messages, requested = new Map();
    for (const message of messages) for (const block of message.content ?? []) {
      if (block.toolUse) requested.set(block.toolUse.toolUseId,block.toolUse.name);
      if (block.toolResult) for (const content of block.toolResult.content ?? []) {
        if (!content.text) continue;
        const result=JSON.parse(content.text);
        if (result.status!=='error' && result.data?.status!=='error') names.add(requested.get(block.toolResult.toolUseId));
      }
    }
  }
  return names;
}
async function browserChecks(a, b, party) {
  if (!process.env.VIBE_PLAYWRIGHT_MODULE) return;
  const { chromium } = await import(process.env.VIBE_PLAYWRIGHT_MODULE);
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pageA = await desktop.newPage(), pageB = await mobile.newPage();
    for (const [page, user] of [[pageA, a], [pageB, b]]) {
      page.on('pageerror', () => errors.push('browser script error'));
      await page.goto(new URL(`/signin?next=${encodeURIComponent(`/parties/${party.id}`)}`, site).href);
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill(user.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      try { await page.waitForURL(`**/parties/${party.id}`, { timeout: 30000 }); }
      catch {
        console.error('Browser route after sign-in:', new URL(page.url()).pathname);
        console.error('Browser auth alerts:', (await page.getByRole('alert').allTextContents()).join(' | '));
        const { mkdirSync } = await import('node:fs'); mkdirSync('output/playwright', { recursive: true });
        await page.screenshot({path:'output/playwright/auth-failure.png',fullPage:true});
        throw new Error('Browser sign-in did not reach the requested party.');
      }
      await page.getByRole('button', { name: /Party memory/ }).click();
      await page.getByText('We agreed to meet Saturday at 3 PM. The room is still undecided.', { exact: true }).waitFor();
    }
    console.log('PASS browser sign-in and corrected note in both sessions');
    await pageA.getByLabel('New party note').fill('Browser-only suggestion for a whiteboard.');
    await pageA.getByRole('combobox').selectOption('suggestion');
    await pageA.getByRole('button', { name: 'Add note', exact: true }).click();
    await pageB.getByText('Browser-only suggestion for a whiteboard.', { exact: true }).waitFor({ timeout: 30000 });
    console.log('PASS browser note creation propagated to the other session');
    const row = pageA.locator('.party-facts-list li').filter({ hasText: 'Browser-only suggestion for a whiteboard.' });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await pageA.getByLabel('Note text').fill('Browser corrected: bring a whiteboard marker.');
    await pageA.getByRole('button', { name: 'Save correction', exact: true }).click();
    await pageB.getByText('Browser corrected: bring a whiteboard marker.', { exact: true }).waitFor({ timeout: 30000 });
    await pageA.reload();
    await pageA.getByRole('button', { name: /Party memory/ }).click();
    await pageA.getByText('Browser corrected: bring a whiteboard marker.', { exact: true }).waitFor();
    for (const page of [pageA, pageB]) assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Browser has horizontal overflow.');
    const { mkdirSync } = await import('node:fs');
    mkdirSync('output/playwright', { recursive: true });
    await pageA.screenshot({ path: 'output/playwright/party-memory-desktop.png', fullPage: true });
    await pageB.screenshot({ path: 'output/playwright/party-memory-mobile.png', fullPage: true });
    await pageA.locator('.party-facts-list li').filter({ hasText: 'Browser corrected: bring a whiteboard marker.' }).getByRole('button', { name: 'Remove', exact: true }).click();
    await pageB.getByText('Browser corrected: bring a whiteboard marker.', { exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    assert(!errors.length, 'Browser script error observed.');
    console.log('PASS two isolated browsers: note create/edit/delete, cross-user refresh, reload and 390px layout');
  } catch (error) {
    const { mkdirSync } = await import('node:fs'); mkdirSync('output/playwright', { recursive: true });
    let index = 0;
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({path:`output/playwright/browser-diagnostic-${index++}.png`,fullPage:true}).catch(()=>{});
    }
    throw error;
  } finally { await browser.close(); }
}
async function cleanup() {
  if (!config) return;
  // Removing users' memberships before deleting data prevents queued note jobs from creating more notes.
  for (const party of parties) for (const user of users.slice(1)) {
    try { await api(users[0].token, `/parties/${party.id}/members/${user.id}`, 'DELETE'); } catch {}
  }
  let credentials;
  try {
    credentials = JSON.parse(execFileSync('aws', ['configure', 'export-credentials', '--profile', profile, '--format', 'process'], { encoding: 'utf8', stdio: 'pipe' }));
  } catch { throw new Error('Cleanup could not obtain AWS credentials.'); }
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials: { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken } }));
  const partyIds = new Set(parties.map(p => p.id)), userIds = new Set(users.map(u => u.id));
  for (const party of parties) for (const user of users) {
    if (user.id) await db.send(new DeleteCommand({ TableName: 'vibe-dev', Key: { PK: `PARTY#${party.id}`, SK: `MEMBER#${user.id}` } }));
  }
  // Do not make fixture removal depend on unrelated jobs in the shared queue.
  // After deleting canonical parents, allow any already-running 90s invocation
  // to finish before removing these exact provider namespaces.
  const externalWriteBarrier = Date.now() + 95000;

  let start;
  const keys = [];
  do {
    const page = await db.send(new ScanCommand({ TableName: 'vibe-dev', ExclusiveStartKey: start }));
    for (const item of page.Items ?? []) {
      if (partyIds.has(item.partyId) || partyIds.has(item.payload?.partyId) || userIds.has(item.payload?.ownerId) || userIds.has(item.ownerId) || [...partyIds].some(id => (item.PK === `PARTY#${id}` || item.PK === `RATE#party#${id}`)) || [...userIds].some(id => (item.PK === `USER#${id}` || item.PK === `RATE#user#${id}`))) keys.push({ PK: item.PK, SK: item.SK });
    }
    start = page.LastEvaluatedKey;
  } while (start);
  for (let offset = 0; offset < keys.length; offset += 25) {
    let requests = keys.slice(offset, offset + 25).map(Key => ({ DeleteRequest: { Key } }));
    for (let attempt = 0; requests.length && attempt < 5; attempt++) {
      const result = await db.send(new BatchWriteCommand({ RequestItems: { 'vibe-dev': requests } }));
      requests = result.UnprocessedItems?.['vibe-dev'] ?? []; if (requests.length) await delay(1000);
    }
    assert(!requests.length, 'Some fixture records remain after cleanup.');
  }
  for (const user of users) aws('cognito-idp', 'admin-delete-user', { UserPoolId: config.userPoolId, Username: user.username });
  if (process.env.SUPERMEMORY_API_KEY) {
    while (Date.now() < externalWriteBarrier) await delay(Math.min(45000, externalWriteBarrier-Date.now()));
    const client = new Supermemory({ timeoutInSeconds: 15, maxRetries: 1 });
    const namespaces=[...partyIds].map(id=>`vibe-dev-party-${id}`).concat([...userIds].flatMap(id=>[`vibe-dev-user-${id}-private`,`vibe-dev-user-${id}-shared`]));
    for (const namespace of namespaces) {
      try { await client.namespaces.delete(namespace); }
      catch (error) { if (Number(error.statusCode ?? error.status) !== 404) throw new Error('Party provider cleanup remains pending.'); }
    }
  }
  console.log(`PASS fixture cleanup (${keys.length} records, ${users.length} users)`);
}
let failure;
try {
  config = await (await fetch(new URL('/config.json', site))).json();
  assert(config.region === region, 'Unexpected deployment region.');
  if (process.env.VIBE_VERIFY_SEMESTER === 'true') {
    const a = await createUser('A');
    const party = await api(a.token,'/parties','POST',{name:'Milestone 3A synthetic test',goal:'Choose a CSE 511 class for Spring 2027.'});
    parties.push(party);
    const result=await mention(a,party,'@Vibe, which CSE 511 sections can I choose for the semester in our party goal? Show sourced meeting schedules.');
    const reply=result.page.messages.find(m=>m.id===result.page.runs.find(r=>r.id===result.sent.run.id).replyMessageId);
    assert(completedTools(party,result.sent.run.id).has('search_classes'),'Natural-semester prompt did not execute class search');
    assert(reply?.citations?.some(c=>new URL(c.url).searchParams.get('term')==='2271'),'Natural-semester search did not resolve Spring 2027 to 2271');
    assert(!/(?:provide|what is|need to know|could you.*(?:give|tell)).{0,60}term code/i.test(reply?.text??''),'Reply still asks the person for a term code');
    console.log('PASS natural semester from party goal -> real ASU search for 2271 with citations, without requesting a term code');
  } else {
  const a = await createUser('A'), b = await createUser('B');
  console.log('PASS independent Cognito identities');
  const party = await api(a.token, '/parties', 'POST', { name: 'Milestone 3A synthetic test', goal: 'Agree on a study meeting and select a room.' });
  parties.push(party);
  await api(b.token, `/parties/${party.id}/facts`, 'GET', undefined, 403);
  await api(b.token, `/parties/${party.id}/facts`, 'POST', { text: 'Unauthorized', kind: 'suggestion' }, 403);
  const invite = await api(a.token, `/parties/${party.id}/invites`, 'POST', {});
  await api(b.token, `/invites/${invite.token}/join`, 'POST', {});
  await api(a.token, `/parties/${party.id}/messages`, 'POST', { text: 'I suggest meeting Friday at 3 PM.', clientId: randomUUID() });
  await api(b.token, `/parties/${party.id}/messages`, 'POST', { text: "Yes, Friday at 3 PM works; let's meet then. Which room should we use?", clientId: randomUUID() });
  const first = await mention(a, party, '@Vibe, capture our meeting decision and unresolved room question.');
  let observedNoteKinds = [];
  const facts = await waitFor(async () => {
    const facts = (await api(a.token, `/parties/${party.id}/facts`)).facts;
    observedNoteKinds=facts.map(f=>({kind:f.kind,topic:f.topic,sources:f.sourceMessageIds.length}));
    return facts.some(f => f.kind === 'decision') && facts.some(f => f.kind === 'question') ? facts : undefined;
  }, 'sourced decision and unresolved question').catch(error=>{console.error('Observed synthetic note categories:',JSON.stringify(observedNoteKinds));throw error;});
  const decision = facts.find(f => f.kind === 'decision');
  assert(decision.sourceMessageIds.length >= 2, 'Decision lacks two supporting messages.');
  assert((await api(b.token, `/parties/${party.id}/facts`)).facts.some(f => f.id === decision.id), 'Other member cannot reload notes.');
  console.log('PASS sourced decision/question extraction and member reload');
  await api(b.token, `/parties/${party.id}/facts/${decision.id}`, 'PATCH', {version:decision.version,text:'Unauthorized overwrite',kind:'decision'}, 403);
  const correction = await api(a.token, `/parties/${party.id}/facts/${decision.id}`, 'PATCH', { version: decision.version, text: 'We agreed to meet Saturday at 3 PM. The room is still undecided.', kind: 'decision' });
  await api(a.token, `/parties/${party.id}/facts/${decision.id}`, 'PATCH', { version: decision.version, text: 'Stale edit', kind: 'decision' }, 409);
  const recalled = await mention(a, party, '@Vibe, on which day and at what time is our meeting? Use the corrected party note.');
  const reply = recalled.page.messages.find(m => m.id === recalled.page.runs.find(r => r.id === recalled.sent.run.id).replyMessageId);
  assert(/saturday/i.test(reply?.text ?? ''), 'Next AI answer did not honor the correction.');
  assert(!(await api(a.token, `/parties/${party.id}/facts`)).facts.some(f => f.sourceMessageIds.includes(recalled.sent.message.id)), 'Reminder request became an unresolved party note.');
  console.log('PASS correction controls the next AI answer; stale edit rejected');
  await api(a.token, `/parties/${party.id}/messages`, 'POST', {text:'I like databases and prefer classes before 5 PM.',clientId:randomUUID()});
  await api(b.token, `/parties/${party.id}/messages`, 'POST', {text:'I like robotics and ML. Classes must end before 5 PM for me.',clientId:randomUUID()});
  await mention(a, party, '@Vibe, summarize each person’s class preferences.');
  const preferences = await waitFor(async()=>{const rows=(await api(a.token, `/parties/${party.id}/facts`)).facts;return rows.some(f=>f.subjectId===a.id)&&rows.some(f=>f.subjectId===b.id)?rows:undefined;}, 'named participant preferences');
  const ownPreference=preferences.find(f=>f.subjectId===a.id&&f.topic==='interests')??preferences.find(f=>f.subjectId===a.id);
  await api(b.token, `/parties/${party.id}/facts/${ownPreference.id}`, 'PATCH', {version:ownPreference.version,text:'Overwrite someone else',kind:'preference'},403);
  await api(a.token, `/parties/${party.id}/messages`, 'POST', {text:'Circuits also interest me, alongside databases.',clientId:randomUUID()});
  await mention(a,party,'@Vibe, update my interests with that detail.');
  await waitFor(async()=>{const rows=(await api(a.token, `/parties/${party.id}/facts`)).facts;return rows.some(f=>f.subjectId===a.id&&f.topic==='interests'&&/circuits/i.test(f.text));},'consolidated interests');
  assert((await api(a.token, `/parties/${party.id}/facts`)).facts.filter(f=>f.subjectId===a.id&&f.topic==='interests').length===1,'Duplicate interests notes');
  console.log('PASS named preference consolidation, ownership and concurrent extraction/answer generation');
  const point=await api(a.token,'/me/memories','POST',{text:'Synthetic owner-only travel preference: vegetarian food.',category:'travel'});
  const preview=await api(a.token,'/me/memory-profile');
  assert(preview.buckets.some(bucket=>bucket.points.some(p=>p.id===point.id)),'Owner preview omitted canonical point');
  assert(!(await api(b.token,'/me/memory-profile')).buckets.some(bucket=>bucket.points.some(p=>p.id===point.id)),'Owner profile leaked');
  await api(a.token,`/me/memories/${point.id}`,'PATCH',{version:point.version,text:'Synthetic owner-only travel preference: vegan food.'});
  assert(JSON.stringify(await api(a.token,'/me/memory-profile')).includes('vegan food'),'Profile did not honor correction');
  console.log('PASS categorized owner profile, isolation and immediate correction');
  const researched=await mention(a,party,'@Vibe, use search_classes to find ASU CSE 511 sections for term 2271 (Spring 2027), then invoke compare_group_schedules using their sourced meeting intervals. Explain compatibility with both participants’ before-5-PM constraints and cite sources. Unknown meetings or eligibility must remain unverified.');
  const researchReply=researched.page.messages.find(m=>m.id===researched.page.runs.find(r=>r.id===researched.sent.run.id).replyMessageId);
  assert(researchReply?.citations?.some(c=>c.url.includes('asu.edu')),'Class research produced no ASU citation');
  const classTools=completedTools(party,researched.sent.run.id);
  assert(classTools.has('search_classes')&&classTools.has('compare_group_schedules'),'Class lookup or deterministic comparison did not complete');
  const professors=await mention(a,party,'@Vibe, use find_professors to resolve Jin Wang at ASU Tempe, then retrieve a small review sample only if the identity is clear. Cite the professor source and preserve ambiguity if present.');
  assert(completedTools(party,professors.sent.run.id).has('find_professors'),'Professor identity lookup did not complete');
  console.log('PASS persisted ASU lookup, deterministic comparison and RMP identity tools');
  const general=await mention(a,party,'@Vibe, use web_search to find the official City of Tempe public library website and cite the official URL.');
  const generalReply=general.page.messages.find(m=>m.id===general.page.runs.find(r=>r.id===general.sent.run.id).replyMessageId);
  assert(generalReply?.citations?.length,'General research produced no citation');
  console.log('PASS real class research and general TinyFish research with persisted citations');
  await browserChecks(a, b, party);
  const other = await api(a.token, '/parties', 'POST', { name: 'Isolation check', goal: 'Separate discussion.' }); parties.push(other);
  const otherInvite = await api(a.token, `/parties/${other.id}/invites`, 'POST', {});
  await api(b.token, `/invites/${otherInvite.token}/join`, 'POST', {});
  assert(!(await api(b.token, `/parties/${other.id}/facts`)).facts.length, 'Notes leaked into another party.');
  await api(a.token, `/parties/${party.id}/facts/${decision.id}`, 'DELETE', { version: correction.version });
  assert(!(await api(a.token, `/parties/${party.id}/facts`)).facts.some(f => f.id === decision.id), 'Deleted note returned.');
  await api(a.token, `/parties/${party.id}/members/${b.id}`, 'DELETE');
  await api(b.token, `/parties/${party.id}/facts`, 'GET', undefined, 403);
  await api(b.token, `/parties/${party.id}/facts/${decision.id}`, 'DELETE', { version: correction.version + 1 }, 403);
  console.log('PASS deletion, same-member party isolation and removed-member rejection');
  }
} catch (error) { failure = error; console.error('Scenario failure:', error.message); }
finally {
  try { await cleanup(); } catch (error) { console.error(error.message); failure ??= error; }
  rmSync(directory, { recursive: true, force: true });
}
if (failure) { console.error(failure.message); process.exitCode = 1; }
