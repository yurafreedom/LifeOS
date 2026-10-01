import {
  assertCurrent,
  reportAuthFailure,
  ticketFor,
} from './accountBinding';
import type { BoundRequest, BoundTicket } from './accountBinding';

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

export type RequestOptions = BoundRequest;

/**
 * The one authenticated fetch: same-origin, account-bound (see accountBinding.ts),
 * generation-checked. A response that settles after the tab's account changed
 * is never handed back — it becomes an `AccountChangedError`.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<{ response: Response; ticket: BoundTicket }> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('API paths must be same-origin absolute paths.');
  }
  const ticket = ticketFor(init, options);
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: ticket.headers,
      signal: ticket.signal,
    });
  } catch (error) {
    assertCurrent(ticket);
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }
  assertCurrent(ticket);
  return { response, ticket };
}

/** Turn a non-OK response into an ApiError and notify the auth listener when relevant. */
export async function failureFrom(response: Response, ticket: BoundTicket, fallback?: string): Promise<ApiError> {
  const body = await readResponseBody(response).catch(() => null);
  assertCurrent(ticket);
  const record = isRecord(body) ? body : null;
  const code = typeof record?.code === 'string' ? record.code : `http_${response.status}`;
  const message = typeof record?.message === 'string'
    ? record.message
    : fallback ?? `Request failed with status ${response.status}.`;
  reportAuthFailure(ticket, response.status, code);
  return new ApiError(response.status, code, message, body);
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const { response, ticket } = await apiFetch(path, { ...init, headers }, options);
  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await failureFrom(response, ticket);
  const body = await readResponseBody(response);
  assertCurrent(ticket);
  return body as T;
}
