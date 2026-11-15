#!/usr/bin/env node
/*
 * Bounded deployed Milestone 2 smoke check.
 * Run with Node 24+: node --env-file=.env.m2verify scripts/verify-milestone2.mjs
 * The environment file is local and ignored by git; never print its values.
 */

import { randomUUID } from 'node:crypto';

const requiredEnv = [
  'VIBE_URL',
  'VIBE_TEST_EMAIL_A',
  'VIBE_TEST_PASSWORD_A',
  'VIBE_TEST_EMAIL_B',
  'VIBE_TEST_PASSWORD_B',
];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(2);
}

class SafeFailure extends Error {}

class HttpFailure extends SafeFailure {
  constructor(status, code) {
    super(`HTTP ${status}${code ? ` ${code}` : ''}`);
    this.status = status;
    this.code = code;
  }
}

function assert(condition, message) {
  if (!condition) throw new SafeFailure(message);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function login(region, cognitoClientId, email, password, label) {
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: cognitoClientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SafeFailure(`Cognito login ${label} request failed.`);
  }
  const data = await readJson(response);
  if (!response.ok) {
    const rawCode = data?.__type ?? data?.code ?? '';
    const safeCode = typeof rawCode === 'string' ? rawCode.split('#').at(-1).split(':').at(-1) : '';
    throw new SafeFailure(`Cognito login ${label} failed${safeCode ? ` (${safeCode})` : ` (HTTP ${response.status})`}.`);
  }
  const idToken = data?.AuthenticationResult?.IdToken;
  if (typeof idToken !== 'string' || !idToken) throw new SafeFailure(`Cognito login ${label} returned no ID token.`);
  return idToken;
}

function getConfigValue(config, key) {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readPublicConfig(siteUrl) {
  let response;
  try {
    response = await fetch(new URL('/config.json', siteUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SafeFailure('Could not fetch public config.json.');
  }
  if (!response.ok) throw new SafeFailure(`Public config.json returned HTTP ${response.status}.`);
  const config = await readJson(response);
  for (const key of ['region', 'userPoolId', 'userPoolClientId', 'apiUrl']) {
    if (!getConfigValue(config, key)) throw new SafeFailure(`Public config.json is missing ${key}.`);
  }
  return config;
}

function makeApi(apiUrl, siteOrigin) {
  const baseUrl = new URL(apiUrl, `${siteOrigin}/`).href.replace(/\/+$/, '');
  return async function request(idToken, path, options = {}) {
    const headers = new Headers({ accept: 'application/json' });
    headers.set('authorization', `Bearer ${idToken}`);
    let body;
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        ...(body === undefined ? {} : { body }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      });
    } catch {
      throw new SafeFailure(`API ${options.method ?? 'GET'} request failed.`);
    }
    const data = await readJson(response);
    if (!response.ok) {
      const rawCode = typeof data?.code === 'string' ? data.code : '';
      const code = /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : undefined;
      throw new HttpFailure(response.status, code);
    }
    return data;
  };
}

async function expectHttp(request, token, path, options, status, code) {
  try {
    await request(token, path, options);
  } catch (error) {
    if (error instanceof HttpFailure && error.status === status && (!code || error.code === code)) return;
    throw error;
  }
  throw new SafeFailure(`Expected HTTP ${status}${code ? ` ${code}` : ''} for ${path}.`);
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(readValue, isReady, timeoutMs, intervalMs, description) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (isReady(value)) return value;
    await sleep(Math.min(intervalMs, Math.max(1, deadline - Date.now())));
  }
  throw new SafeFailure(`${description} did not complete within ${Math.ceil(timeoutMs / 1_000)} seconds.`);
}

async function getMemories(request, token) {
  const result = await request(token, '/me/memories');
  assert(Array.isArray(result?.memories), 'The memory list response was invalid.');
  return result.memories;
}

function hasMemoryOwnedBy(memories, ownerId, factId, text) {
  return memories.some((fact) => fact.id === factId || fact.ownerId === ownerId || fact.text === text);
}

async function waitForRun(request, token, partyPath, runId, expectedWord, label) {
  const run = await pollUntil(
    () => request(token, `${partyPath}/runs/${encodeURIComponent(runId)}`),
    (value) => value?.status === 'completed' || value?.status === 'failed' || value?.status === 'cancelled',
    180_000,
    2_000,
    `${label} @Vibe run`,
  );
  assert(run.status === 'completed', `${label} @Vibe run ended with status ${String(run.status)}.`);
  assert(typeof run.replyMessageId === 'string' && run.replyMessageId, `${label} completed run has no reply ID.`);
  const history = await request(token, `${partyPath}/messages?limit=50`);
  const reply = history?.messages?.find((message) => message.id === run.replyMessageId);
  assert(reply && typeof reply.text === 'string' && reply.text.trim(), `${label} reply was not persisted.`);
  assert(new RegExp(`\\b${expectedWord}\\b`, 'i').test(reply.text), `${label} reply did not reflect the approved dietary fact.`);
  pass(`${label} @Vibe reply completed with expected memory (runId=${runId}; replyId=${run.replyMessageId})`);
  return { run, reply };
}

const rawSiteUrl = process.env.VIBE_URL;
let siteOrigin;
try {
  const parsed = new URL(rawSiteUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid scheme');
  siteOrigin = parsed.origin;
} catch {
  console.error('VIBE_URL must be an http(s) URL.');
  process.exit(2);
}

try {
  const config = await readPublicConfig(siteOrigin);
  const region = getConfigValue(config, 'region');
  const cognitoClientId = getConfigValue(config, 'userPoolClientId');
  const request = makeApi(getConfigValue(config, 'apiUrl'), siteOrigin);
  pass(`public config (${region})`);

  const [tokenA, tokenB] = await Promise.all([
    login(region, cognitoClientId, process.env.VIBE_TEST_EMAIL_A, process.env.VIBE_TEST_PASSWORD_A, 'A'),
    login(region, cognitoClientId, process.env.VIBE_TEST_EMAIL_B, process.env.VIBE_TEST_PASSWORD_B, 'B'),
  ]);
  pass('Cognito login (A and B)');

  const profileA = await request(tokenA, '/me');
  assert(typeof profileA?.id === 'string' && profileA.id, 'Profile A returned no ID.');
  assert(profileA.learningEnabled === false, 'Profile A must start with automatic learning off.');
  pass(`profile A starts with learning off (ownerId=${profileA.id})`);

  const privateMarker = `M2 private isolation ${randomUUID()}`;
  const manual = await request(tokenA, '/me/memories', {
    method: 'POST',
    body: { text: privateMarker, category: 'general', approved: false },
  });
  assert(manual?.id && manual.ownerId === profileA.id && manual.approval === 'private', 'Manual memory was not saved privately.');
  const editedManual = await request(tokenA, `/me/memories/${encodeURIComponent(manual.id)}`, {
    method: 'PATCH',
    body: { version: manual.version, text: `${privateMarker} edited` },
  });
  assert(editedManual?.version === manual.version + 1 && editedManual.approval === 'private', 'Manual private memory edit did not advance its version.');
  await expectHttp(request, tokenA, `/me/memories/${encodeURIComponent(manual.id)}`, {
    method: 'PATCH', body: { version: manual.version, text: `${privateMarker} stale edit` },
  }, 409, 'MEMORY_CONFLICT');
  pass(`manual private create and stale-version conflict (factId=${manual.id})`);

  const profileB = await request(tokenB, '/me');
  assert(typeof profileB?.id === 'string' && profileB.id && profileB.id !== profileA.id, 'The two authenticated profiles are not independent.');
  const memoriesB = await getMemories(request, tokenB);
  assert(!hasMemoryOwnedBy(memoriesB, profileA.id, manual.id, privateMarker), 'Member B can see A’s private manual memory.');
  pass('member B cannot read A’s private manual memory');

  const updatedProfileA = await request(tokenA, '/me', { method: 'PUT', body: { learningEnabled: true } });
  assert(updatedProfileA?.learningEnabled === true, 'Automatic learning did not turn on.');
  pass('A enabled automatic learning');

  const partyA = await request(tokenA, '/parties', {
    method: 'POST',
    body: { name: `M2 source ${randomUUID()}`, goal: 'Plan a meal that fits the group.' },
  });
  assert(typeof partyA?.id === 'string' && partyA.id, 'Source party creation returned no ID.');
  const partyAPath = `/parties/${encodeURIComponent(partyA.id)}`;
  const inviteA = await request(tokenA, `${partyAPath}/invites`, { method: 'POST', body: {} });
  const joinedA = await request(tokenB, `/invites/${encodeURIComponent(inviteA.token)}/join`, { method: 'POST', body: {} });
  assert(joinedA?.id === partyA.id, 'Member B could not join the source party.');
  pass(`source party joined by B (partyId=${partyA.id})`);

  const sourceText = '@Vibe I prefer vegetarian meals.';
  const sourceSend = await request(tokenA, `${partyAPath}/messages`, {
    method: 'POST',
    body: { text: sourceText, clientId: randomUUID() },
  });
  assert(sourceSend?.message?.id && sourceSend.run?.id, 'The source message or forced @Vibe run was not created.');
  const candidate = await pollUntil(
    async () => {
      const memories = await getMemories(request, tokenA);
      return memories.find((fact) => fact.ownerId === profileA.id && fact.source === 'conversation' &&
        fact.sourcePartyId === partyA.id && fact.sourceMessageIds?.includes(sourceSend.message.id));
    },
    (fact) => Boolean(fact && fact.approval === 'candidate' && /vegetarian/i.test(fact.text)),
    150_000,
    2_000,
    'conversation memory extraction',
  );
  assert(candidate?.id && candidate.ownerId === profileA.id && candidate.sourceMessageIds.includes(sourceSend.message.id), 'Extracted candidate provenance was incorrect.');
  pass(`self-authored candidate extracted from source message (factId=${candidate.id}; sourceMessageId=${sourceSend.message.id})`);

  const approved = await request(tokenA, `/me/memories/${encodeURIComponent(candidate.id)}`, {
    method: 'PATCH',
    body: { version: candidate.version, approved: true },
  });
  assert(approved?.approval === 'approved' && approved.approvedVersion === approved.version, 'Candidate was not explicitly approved at its current version.');
  await pollUntil(
    async () => (await getMemories(request, tokenA)).find((fact) => fact.id === candidate.id),
    (fact) => fact?.approval === 'approved' && fact.approvedVersion === fact.version && fact.syncState === 'synced',
    180_000,
    2_000,
    'approved memory provider sync',
  );
  pass(`approved fact synced (factId=${candidate.id}; version=${approved.version})`);

  const partyB = await request(tokenA, '/parties', {
    method: 'POST',
    body: { name: `M2 reuse ${randomUUID()}`, goal: 'Choose a dinner for the group.' },
  });
  assert(typeof partyB?.id === 'string' && partyB.id, 'Reuse party creation returned no ID.');
  const partyBPath = `/parties/${encodeURIComponent(partyB.id)}`;
  const inviteB = await request(tokenA, `${partyBPath}/invites`, { method: 'POST', body: {} });
  const joinedB = await request(tokenB, `/invites/${encodeURIComponent(inviteB.token)}/join`, { method: 'POST', body: {} });
  assert(joinedB?.id === partyB.id, 'Member B could not join the reuse party.');
  const sharing = await request(tokenA, `${partyBPath}/membership`, {
    method: 'PATCH',
    body: { useSharedMemory: true },
  });
  assert(sharing?.userId === profileA.id && sharing.useSharedMemory === true, 'A’s per-party shared-memory setting did not turn on.');
  pass(`A opted in to shared memory for the reuse party (partyId=${partyB.id})`);

  const firstVibe = await request(tokenA, `${partyBPath}/messages`, {
    method: 'POST',
    body: { text: '@Vibe Suggest a dinner that fits my dietary preference.', clientId: randomUUID() },
  });
  assert(firstVibe?.run?.id, 'First reuse-party @Vibe mention did not create a run.');
  await waitForRun(request, tokenA, partyBPath, firstVibe.run.id, 'vegetarian', 'Initial approved reuse');

  const corrected = await request(tokenA, `/me/memories/${encodeURIComponent(candidate.id)}`, {
    method: 'PATCH',
    body: { version: approved.version, text: 'I eat vegan meals and avoid all animal products.', approved: true },
  });
  assert(corrected?.version === approved.version + 1 && corrected.approval === 'approved' && corrected.approvedVersion === corrected.version,
    'Corrected memory was not approved at its new version.');
  const secondVibe = await request(tokenA, `${partyBPath}/messages`, {
    method: 'POST',
    body: { text: '@Vibe What dietary preference should you use now? Be specific.', clientId: randomUUID() },
  });
  assert(secondVibe?.run?.id, 'Correction-check @Vibe mention did not create a run.');
  await waitForRun(request, tokenA, partyBPath, secondVibe.run.id, 'vegan', 'After correction');

  const deleted = await request(tokenA, `/me/memories/${encodeURIComponent(candidate.id)}`, {
    method: 'DELETE',
    body: { version: corrected.version },
  });
  assert(deleted?.deleted === true && deleted.syncState === 'deleting', 'Memory deletion did not immediately write a tombstone and pending cleanup state.');
  await pollUntil(
    async () => (await getMemories(request, tokenA)).find((fact) => fact.id === candidate.id),
    (fact) => fact?.deleted === true && fact.syncState === 'synced',
    180_000,
    2_000,
    'approved memory provider cleanup',
  );
  pass(`approved memory tombstoned and provider cleanup confirmed (factId=${candidate.id})`);

  const deletedManual = await request(tokenA, `/me/memories/${encodeURIComponent(manual.id)}`, {
    method: 'DELETE',
    body: { version: editedManual.version },
  });
  assert(deletedManual?.deleted === true && deletedManual.syncState === 'deleting', 'Private manual memory deletion did not create a tombstone.');
  await pollUntil(
    async () => (await getMemories(request, tokenA)).find((fact) => fact.id === manual.id),
    (fact) => fact?.deleted === true && fact.syncState === 'synced',
    180_000,
    2_000,
    'private manual memory cleanup',
  );
  pass(`private manual memory deleted and cleanup confirmed (factId=${manual.id})`);

  const finalMemoriesB = await getMemories(request, tokenB);
  assert(!hasMemoryOwnedBy(finalMemoriesB, profileA.id, candidate.id, 'I eat vegan meals and avoid all animal products.'),
    'Member B’s personal memory list contains A’s private or shared fact.');
  pass('member B’s personal memory list remains owner-scoped');
  pass(`Milestone 2 smoke verification complete (ownerId=${profileA.id}; sourcePartyId=${partyA.id}; reusePartyId=${partyB.id}; candidateId=${candidate.id}; privateFactId=${manual.id})`);
} catch (error) {
  const safeMessage = error instanceof SafeFailure
    ? error.message
    : `Unexpected smoke verification error (${error instanceof Error ? error.name : 'unknown'}).`;
  console.error(`FAIL ${safeMessage}`);
  process.exitCode = 1;
}
