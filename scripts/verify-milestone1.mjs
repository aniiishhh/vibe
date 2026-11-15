#!/usr/bin/env node
/*
 * Minimal deployed Milestone 1 smoke check.
 * Run with Node 24+: node --env-file=.env.verify scripts/verify-milestone1.mjs
 * The environment file should stay local; .env.* is ignored by git.
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

function makeApi(apiUrl) {
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
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new SafeFailure(`API ${options.method ?? 'GET'} request failed.`);
    }
    const data = await readJson(response);
    if (!response.ok) {
      const code = typeof data?.code === 'string' ? data.code : undefined;
      throw new HttpFailure(response.status, code);
    }
    return data;
  };
}

async function expectForbidden(request, token, path) {
  try {
    await request(token, path);
  } catch (error) {
    if (error instanceof HttpFailure && error.status === 403 && error.code === 'FORBIDDEN') return;
    throw error;
  }
  throw new SafeFailure(`Expected HTTP 403 for ${path}.`);
}

function pass(message) {
  console.log(`PASS ${message}`);
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
  const request = makeApi(getConfigValue(config, 'apiUrl'));
  pass(`public config (${region})`);

  const [tokenA, tokenB] = await Promise.all([
    login(region, cognitoClientId, process.env.VIBE_TEST_EMAIL_A, process.env.VIBE_TEST_PASSWORD_A, 'A'),
    login(region, cognitoClientId, process.env.VIBE_TEST_EMAIL_B, process.env.VIBE_TEST_PASSWORD_B, 'B'),
  ]);
  pass('Cognito login (A and B)');

  const [profileA, profileB] = await Promise.all([
    request(tokenA, '/me'),
    request(tokenB, '/me'),
  ]);
  assert(profileA?.id && profileB?.id && profileA.id !== profileB.id, 'The two authenticated profiles are not independent.');
  pass('authenticated profiles');

  const party = await request(tokenA, '/parties', {
    method: 'POST',
    body: { name: `Milestone 1 smoke ${new Date().toISOString()}`, goal: 'Plan a small group study break.' },
  });
  assert(typeof party?.id === 'string' && party.id, 'Party creation returned no ID.');
  const partyPath = `/parties/${encodeURIComponent(party.id)}`;
  await expectForbidden(request, tokenB, partyPath);
  await expectForbidden(request, tokenB, `${partyPath}/messages`);
  await expectForbidden(request, tokenB, `${partyPath}/runs/nonmember-check`);
  pass(`party created and non-member reads rejected (partyId=${party.id})`);

  const invite = await request(tokenA, `${partyPath}/invites`, { method: 'POST', body: {} });
  assert(typeof invite?.token === 'string' && invite.token, 'Invite creation returned no token.');
  const joinedParty = await request(tokenB, `/invites/${encodeURIComponent(invite.token)}/join`, { method: 'POST', body: {} });
  assert(joinedParty?.id === party.id, 'Invite redemption returned a different party.');
  pass('invite join');

  const clientId = randomUUID();
  const sendA = await request(tokenA, `${partyPath}/messages`, {
    method: 'POST',
    body: { text: 'Smoke check: suggest a relaxed study break activity.', clientId },
  });
  const retryA = await request(tokenA, `${partyPath}/messages`, {
    method: 'POST',
    body: { text: 'Smoke check: suggest a relaxed study break activity.', clientId },
  });
  assert(sendA?.message?.id && retryA?.message?.id === sendA.message.id, 'Duplicate send did not return the original message.');
  const sendB = await request(tokenB, `${partyPath}/messages`, {
    method: 'POST',
    body: { text: 'Smoke check: I prefer something low-key.', clientId: randomUUID() },
  });
  assert(sendB?.message?.id, 'Member B message was not persisted.');
  pass('message persistence and author-scoped idempotency');

  const vibeSend = await request(tokenA, `${partyPath}/messages`, {
    method: 'POST',
    body: { text: '@Vibe suggest one simple next step for our study break.', clientId: randomUUID() },
  });
  const runId = vibeSend?.run?.id;
  assert(typeof runId === 'string' && runId, 'Mention did not create an agent run.');

  const deadline = Date.now() + 180_000;
  let run;
  while (Date.now() < deadline) {
    run = await request(tokenA, `${partyPath}/runs/${encodeURIComponent(runId)}`);
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  assert(run?.status === 'completed', 'The @Vibe run did not complete within 180 seconds.');
  assert(typeof run.replyMessageId === 'string' && run.replyMessageId, 'Completed run has no reply message ID.');

  const firstHistory = await request(tokenA, `${partyPath}/messages`);
  const firstAssistantReplies = firstHistory.messages.filter((message) =>
    message.role === 'assistant' && (message.runId === runId || message.id === run.replyMessageId),
  );
  assert(firstAssistantReplies.length === 1, 'Expected exactly one assistant reply for the run.');
  assert(typeof firstAssistantReplies[0].text === 'string' && firstAssistantReplies[0].text.trim(), 'Assistant reply was empty.');
  assert(firstHistory.messages.some((message) => message.id === sendA.message.id), 'A message was missing from persisted history.');
  assert(firstHistory.messages.some((message) => message.id === sendB.message.id), 'B message was missing from persisted history.');
  assert(firstHistory.messages.filter((message) => message.id === sendA.message.id).length === 1, 'Idempotent retry created a duplicate message.');

  const freshHistory = await request(tokenA, `${partyPath}/messages`);
  const freshReplies = freshHistory.messages.filter((message) => message.id === run.replyMessageId);
  assert(freshReplies.length === 1 && freshReplies[0].text === firstAssistantReplies[0].text, 'Reply did not persist across a fresh history read.');
  pass(`real @Vibe reply completed and persisted once (runId=${runId}; replyId=${run.replyMessageId})`);

  await request(tokenA, `${partyPath}/members/${encodeURIComponent(profileB.id)}`, { method: 'DELETE' });
  await expectForbidden(request, tokenB, `${partyPath}/messages`);
  await expectForbidden(request, tokenB, `${partyPath}/runs/${encodeURIComponent(runId)}`);
  pass('owner removal blocks subsequent content reads');
  pass('Milestone 1 smoke verification complete');
} catch (error) {
  const safeMessage = error instanceof SafeFailure
    ? error.message
    : `Unexpected smoke verification error (${error instanceof Error ? error.name : 'unknown'}).`;
  console.error(`FAIL ${safeMessage}`);
  process.exitCode = 1;
}
