export interface RuntimeConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  apiUrl: string;
  eventsHttpEndpoint: string;
  eventsRealtimeEndpoint: string;
}

export interface RuntimeConfigResult {
  config?: RuntimeConfig;
  missing: string[];
  source: 'public-config' | 'environment' | 'mixed' | 'none';
  loadError?: string;
}

type ConfigCandidate = Partial<Record<keyof RuntimeConfig, unknown>>;

const configKeys: Array<keyof RuntimeConfig> = [
  'region',
  'userPoolId',
  'userPoolClientId',
  'apiUrl',
  'eventsHttpEndpoint',
  'eventsRealtimeEndpoint',
];

const environmentConfig: ConfigCandidate = {
  region: import.meta.env.VITE_REGION,
  userPoolId: import.meta.env.VITE_USER_POOL_ID,
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  apiUrl: import.meta.env.VITE_API_URL,
  eventsHttpEndpoint: import.meta.env.VITE_EVENTS_HTTP_ENDPOINT,
  eventsRealtimeEndpoint: import.meta.env.VITE_EVENTS_REALTIME_ENDPOINT,
};

function cleanConfig(value: unknown): ConfigCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ConfigCandidate;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfigResult> {
  let deployed: ConfigCandidate = {};
  let loadError: string | undefined;
  let publicConfigLoaded = false;

  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (response.ok) {
      deployed = cleanConfig(await response.json());
      publicConfigLoaded = true;
    } else if (response.status !== 404) {
      loadError = `The deployment settings returned HTTP ${response.status}.`;
    }
  } catch {
    loadError = 'The deployment settings could not be reached.';
  }

  const values = Object.fromEntries(
    configKeys.map((key) => [key, readString(deployed[key]) ?? readString(environmentConfig[key])]),
  ) as Partial<RuntimeConfig>;
  const missing = configKeys.filter((key) => !values[key]);
  const envHasValues = configKeys.some((key) => readString(environmentConfig[key]));
  const source: RuntimeConfigResult['source'] = publicConfigLoaded
    ? envHasValues
      ? 'mixed'
      : 'public-config'
    : envHasValues
      ? 'environment'
      : 'none';

  if (missing.length > 0) return { missing, source, loadError };

  return {
    config: values as RuntimeConfig,
    missing: [],
    source,
    loadError,
  };
}

export function deriveRealtimeEndpoint(httpEndpoint: string): string | undefined {
  try {
    const endpoint = new URL(httpEndpoint);
    endpoint.protocol = 'wss:';
    endpoint.hostname = endpoint.hostname.replace('appsync-api', 'appsync-realtime-api');
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/realtime`;
    endpoint.search = '';
    endpoint.hash = '';
    return endpoint.toString();
  } catch {
    return undefined;
  }
}
