import { fetchAuthSession } from 'aws-amplify/auth';
import type {
  AgentRun,
  Invite,
  Member,
  MessagePage,
  Party,
  Profile,
  SendResult,
} from '@vibe/shared';
import type { RuntimeConfig } from './runtime';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;

  constructor(message: string, status: number, details?: { code?: string; requestId?: string; retryable?: boolean }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = details?.code;
    this.requestId = details?.requestId;
    this.retryable = details?.retryable;
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function createApi(config: RuntimeConfig) {
  const baseUrl = config.apiUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { tokens } = await fetchAuthSession();
    const idToken = tokens?.idToken?.toString();
    if (!idToken) throw new Error('Your session expired. Sign in again to continue.');

    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${idToken}`);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(url, { ...init, headers });
    const contentType = response.headers.get('content-type') ?? '';
    const data: unknown = contentType.includes('application/json')
      ? await response.json().catch(() => undefined)
      : await response.text().catch(() => '');

    if (!response.ok) {
      const body = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
      const message = typeof body.message === 'string'
        ? body.message
        : typeof data === 'string' && data.trim()
          ? data
          : `The request failed (${response.status}). Try again.`;
      throw new ApiRequestError(message, response.status, {
        code: typeof body.code === 'string' ? body.code : undefined,
        requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
        retryable: typeof body.retryable === 'boolean' ? body.retryable : undefined,
      });
    }

    return data as T;
  }

  return {
    getProfile: () => request<Profile>('/me'),
    listParties: () => request<{ parties: Party[] }>('/parties'),
    createParty: (body: { name: string; goal: string }) => request<Party>('/parties', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    getParty: (partyId: string) => request<Party>(`/parties/${encodeURIComponent(partyId)}`),
    getMembers: (partyId: string) => request<{ members: Member[] }>(`/parties/${encodeURIComponent(partyId)}/members`),
    removeMember: (partyId: string, userId: string) => request<void>(
      `/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
    createInvite: (partyId: string) => request<Invite>(`/parties/${encodeURIComponent(partyId)}/invites`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    joinInvite: (token: string) => request<Party>(`/invites/${encodeURIComponent(token)}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    getMessages: (partyId: string, cursor?: string) => {
      const query = cursor ? `?${new URLSearchParams({ cursor })}` : '';
      return request<MessagePage>(`/parties/${encodeURIComponent(partyId)}/messages${query}`);
    },
    sendMessage: (partyId: string, body: { text: string; clientId: string }) => request<SendResult>(
      `/parties/${encodeURIComponent(partyId)}/messages`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
    getRun: (partyId: string, runId: string) => request<AgentRun>(
      `/parties/${encodeURIComponent(partyId)}/runs/${encodeURIComponent(runId)}`,
    ),
  };
}

export type VibeApi = ReturnType<typeof createApi>;
