import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Supermemory } from 'supermemory';

const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-2', maxAttempts: 2 });
let apiKeyPromise: Promise<string> | undefined;
let clientPromise: Promise<Supermemory> | undefined;

export type MemoryDocumentTask = 'memory' | 'superrag';

export interface MemoryDocumentInput {
  namespace: string;
  id: string;
  content: string;
  taskType: MemoryDocumentTask;
  metadata?: Record<string, string | number | boolean | string[]>;
  supportingContext?: string;
  waitTimeoutMs?: number;
}

export function stageName(): string {
  const value = process.env.APP_STAGE || 'dev';
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(value)) throw new Error('APP_STAGE is invalid');
  return value;
}

function safeNamespace(value: string): string {
  if (!/^[a-zA-Z0-9_:-]{1,200}$/.test(value)) throw new Error('Invalid memory namespace');
  return value;
}

export function partyNamespace(partyId: string): string {
  return safeNamespace(`vibe-${stageName()}-party-${partyId}`);
}

export function privateNamespace(ownerId: string): string {
  return safeNamespace(`vibe-${stageName()}-user-${ownerId}-private`);
}

export function sharedNamespace(ownerId: string): string {
  return safeNamespace(`vibe-${stageName()}-user-${ownerId}-shared`);
}

export function factDocumentId(factId: string, version: number): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(factId) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Invalid memory fact document identity');
  }
  return `${factId}-v${version}`;
}

export function partyMessageDocumentId(messageId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(messageId)) throw new Error('Invalid party message identity');
  return `message-${messageId}`;
}

async function loadApiKey(): Promise<string> {
  const direct = process.env.SUPERMEMORY_API_KEY?.trim();
  if (direct) return direct;
  const parameterName = process.env.SUPERMEMORY_PARAMETER_NAME;
  if (!parameterName) throw new Error('Supermemory credentials are not configured');
  const response = await ssm.send(new GetParameterCommand({ Name: parameterName, WithDecryption: true }));
  const value = response.Parameter?.Value?.trim();
  if (!value) throw new Error('Supermemory credentials are unavailable');
  return value;
}

export async function getSupermemoryClient(): Promise<Supermemory> {
  if (!clientPromise) {
    apiKeyPromise ??= loadApiKey();
    clientPromise = apiKeyPromise.then((apiKey) => new Supermemory({
      apiKey,
      timeoutInSeconds: 15,
      maxRetries: 1,
    }));
    clientPromise.catch(() => {
      clientPromise = undefined;
      apiKeyPromise = undefined;
    });
  }
  return clientPromise;
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { statusCode?: unknown; status?: unknown; name?: unknown };
  return candidate.statusCode === 404 || candidate.status === 404 ||
    (typeof candidate.name === 'string' && /not.?found/i.test(candidate.name));
}

export async function waitForDocument(
  namespace: string,
  id: string,
  expectedContent: string,
  taskType: MemoryDocumentTask,
  timeoutMs = 55_000,
): Promise<void> {
  const client = await getSupermemoryClient();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const document = await client.documents.get(safeNamespace(namespace), id);
    if (document.system.status === 'failed') throw new Error('Supermemory document processing failed');
    if (document.content === expectedContent && document.system.status === 'done' &&
        (taskType === 'superrag' || document.system.dreamingStatus !== 'dreaming')) return;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, Math.max(1, deadline - Date.now()))));
  }
  throw new Error('Supermemory document processing exceeded its time limit');
}

/** Add a new immutable document or explicitly replace the same version on a retry. */
export async function putMemoryDocument(input: MemoryDocumentInput): Promise<void> {
  const namespace = safeNamespace(input.namespace);
  const client = await getSupermemoryClient();
  let existing: Awaited<ReturnType<typeof client.documents.get>> | undefined;
  try {
    existing = await client.documents.get(namespace, input.id);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (existing?.content === input.content) {
    if (existing.system.status === 'done' &&
        (input.taskType === 'superrag' || existing.system.dreamingStatus !== 'dreaming')) return;
    await waitForDocument(namespace, input.id, input.content, input.taskType, input.waitTimeoutMs ?? 25_000);
    return;
  }

  const request = {
    content: input.content,
    taskType: input.taskType,
    dreaming: 'instant' as const,
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.supportingContext ? { supportingContext: input.supportingContext.slice(0, 1_500) } : {}),
  };
  if (existing) await client.documents.update(namespace, input.id, request);
  else await client.add(namespace, { id: input.id, ...request });
  await waitForDocument(namespace, input.id, input.content, input.taskType, input.waitTimeoutMs ?? 25_000);
}

/** Delete is acknowledged only when every requested ID succeeded. HTTP 200 can be partial. */
export async function deleteMemoryDocuments(namespace: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const client = await getSupermemoryClient();
  try {
    const response = await client.documents.delete(safeNamespace(namespace), { ids: [...new Set(ids)] });
    return response.errors
      .filter((entry) => !/not.?found|does not exist|already deleted/i.test(entry.error))
      .map((entry) => entry.id);
  } catch (error) {
    // A never-created shared namespace is already clean for a private fact.
    if (isNotFound(error)) return [];
    throw error;
  }
}

export function isProviderNotFound(error: unknown): boolean {
  return isNotFound(error);
}

