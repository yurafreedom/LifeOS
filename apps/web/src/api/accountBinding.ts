/**
 * Account binding for every authenticated request (JENKIN S1).
 *
 * The browser's session cookie is shared by every tab. A tab that loaded
 * account A must never save, replay, read or export as account B because
 * another tab signed in as B. This module holds the tab's expected account and
 * a monotonically increasing *generation*:
 *
 * - every request carries `X-LifeOS-Account: <expected id>`; the server refuses
 *   a mismatch (409 `session_user_mismatch`) before touching data. The header is
 *   never authorization — the server always derives ownership from the session;
 * - binding a different account (or none) starts a new generation and aborts
 *   every request of the previous one;
 * - a response that settles after its generation ended is discarded with an
 *   `AccountChangedError` (name `AbortError`, so existing abort handling ignores
 *   it) and never reaches the new account's state.
 *
 * Signals (`session_user_mismatch`, `not_authenticated` while bound) are
 * published to one listener — the AuthProvider — which revalidates identity.
 * Domain errors are never treated as logout.
 */

export const ACCOUNT_HEADER = 'X-LifeOS-Account';

export type AuthSignal =
  | { kind: 'mismatch'; expectedUserId: string }
  | { kind: 'expired'; expectedUserId: string };

type Binding = {
  userId: string | null;
  generation: number;
  controller: AbortController;
};

let binding: Binding = { userId: null, generation: 0, controller: new AbortController() };
const listeners = new Set<(signal: AuthSignal) => void>();

export class AccountChangedError extends Error {
  readonly reason = 'account_changed';

  constructor() {
    super('The signed-in account changed while this request was in flight.');
    // Existing callers already ignore aborted requests by name.
    this.name = 'AbortError';
  }
}

export function isAccountChanged(error: unknown): boolean {
  return error instanceof AccountChangedError;
}

/** Bind the tab to `userId` (or to nobody). A change aborts the previous generation. */
export function bindAccount(userId: string | null): number {
  if (binding.userId === userId) return binding.generation;
  binding.controller.abort();
  binding = { userId, generation: binding.generation + 1, controller: new AbortController() };
  return binding.generation;
}

export function boundAccount(): string | null {
  return binding.userId;
}

export function bindingGeneration(): number {
  return binding.generation;
}

export function onAuthSignal(listener: (signal: AuthSignal) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishAuthSignal(signal: AuthSignal): void {
  for (const listener of [...listeners]) {
    try { listener(signal); } catch { /* a listener must not break the request path */ }
  }
}

function combineSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => signal != null);
  if (present.length === 1) return present[0];
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn(present);
  const controller = new AbortController();
  for (const signal of present) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export type BoundRequest = {
  /** Explicit owner (queued replays carry their record's owner). Defaults to the bound account. */
  account?: string | null;
};

export type BoundTicket = {
  generation: number;
  account: string | null;
  signal: AbortSignal;
  headers: Headers;
};

/** Prepare one request: binding header, generation, and a generation-scoped abort. */
export function ticketFor(init: RequestInit, options: BoundRequest = {}): BoundTicket {
  const account = options.account !== undefined ? options.account : binding.userId;
  const headers = new Headers(init.headers);
  if (account) headers.set(ACCOUNT_HEADER, account);
  return {
    generation: binding.generation,
    account,
    signal: combineSignals([init.signal, binding.controller.signal]),
    headers,
  };
}

/** Throw if the generation that issued `ticket` has ended. */
export function assertCurrent(ticket: BoundTicket): void {
  if (ticket.generation !== binding.generation) throw new AccountChangedError();
}

/** Classify an error response for the auth listener. */
export function reportAuthFailure(ticket: BoundTicket, status: number, code: string): void {
  if (!ticket.account || ticket.generation !== binding.generation) return;
  if (status === 409 && code === 'session_user_mismatch') {
    publishAuthSignal({ kind: 'mismatch', expectedUserId: ticket.account });
  } else if (status === 401 && code === 'not_authenticated') {
    publishAuthSignal({ kind: 'expired', expectedUserId: ticket.account });
  }
}

/** Test seam: forget every binding and listener. */
export function resetAccountBindingForTests(): void {
  binding.controller.abort();
  binding = { userId: null, generation: 0, controller: new AbortController() };
  listeners.clear();
}
