export type ApiErrorBody = {
  code?: string;
  message?: string;
  current_revision?: number;
  detail?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('Network request failed.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('API paths must be same-origin absolute paths.');
  }

  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }

  if (response.status === 204) return undefined as T;
  const body = await readResponseBody(response);
  if (!response.ok) {
    const record = isRecord(body) ? body : null;
    const code = typeof record?.code === 'string' ? record.code : `http_${response.status}`;
    const message = typeof record?.message === 'string'
      ? record.message
      : `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, code, message, body);
  }
  return body as T;
}
