/**
 * The pre-server `lifeOsState` snapshot left in this browser's localStorage.
 *
 * It belongs to no account: whoever used the old local-only version on this
 * device created it. JENKIN S1 rules:
 * - it is never imported automatically; a new account sees it only when no
 *   decision was recorded for that account, and preview, download and import
 *   all require an explicit ownership confirmation;
 * - a recorded decision (`lifeOsLegacyDecision:<user id>`) is respected — the
 *   account is not asked again;
 * - after an import the copy is *retired*, not deleted: moved to
 *   `lifeOsStateRetired` (recoverable, so no other account is offered it);
 *   declining keeps it untouched. Permanent deletion is a separate explicit
 *   action in Settings.
 */

export type LegacyReadResult =
  | { kind: 'absent' }
  | { kind: 'valid'; payload: unknown; raw: string }
  | { kind: 'invalid'; raw: string | null; reason: string };

export type LegacyDecision = { decision: 'imported' | 'fresh'; revision: number };

export const LEGACY_KEY = 'lifeOsState';
export const RETIRED_KEY = 'lifeOsStateRetired';
const DECISION_PREFIX = 'lifeOsLegacyDecision:';

function readKey(key: string): LegacyReadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { kind: 'invalid', raw: null, reason: 'storage_unavailable' };
  }
  if (raw == null) return { kind: 'absent' };
  try {
    return { kind: 'valid', payload: JSON.parse(raw) as unknown, raw };
  } catch {
    return { kind: 'invalid', raw, reason: 'invalid_json' };
  }
}

export function readLegacyLocalState(): LegacyReadResult {
  return readKey(LEGACY_KEY);
}

export type RetiredLegacy = { raw: string; retired_at: string | null; reason: string | null };

export function readRetiredLegacyState(): RetiredLegacy | null {
  try {
    const raw = window.localStorage.getItem(RETIRED_KEY);
    if (raw == null) return null;
    const record = JSON.parse(raw) as { raw?: unknown; retired_at?: unknown; reason?: unknown };
    if (typeof record.raw !== 'string') return null;
    return {
      raw: record.raw,
      retired_at: typeof record.retired_at === 'string' ? record.retired_at : null,
      reason: typeof record.reason === 'string' ? record.reason : null,
    };
  } catch {
    return null;
  }
}

export function recordLegacyDecision(
  userId: string,
  decision: 'imported' | 'fresh',
  revision: number,
): void {
  try {
    window.localStorage.setItem(
      `${DECISION_PREFIX}${userId}`,
      JSON.stringify({ decision, revision }),
    );
  } catch {
    // The marker must never block acknowledged server state.
  }
}

export function readLegacyDecision(userId: string): LegacyDecision | null {
  try {
    const raw = window.localStorage.getItem(`${DECISION_PREFIX}${userId}`);
    if (raw == null) return null;
    const value = JSON.parse(raw) as LegacyDecision;
    return value && (value.decision === 'imported' || value.decision === 'fresh') ? value : null;
  } catch {
    return null;
  }
}

/** Move the legacy copy aside (recoverable). Returns false when nothing moved. */
export function retireLegacyState(reason: 'imported' | 'user_retired'): boolean {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (raw == null) return false;
    window.localStorage.setItem(
      RETIRED_KEY,
      JSON.stringify({ raw, retired_at: new Date().toISOString(), reason }),
    );
    window.localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Put a retired copy back where the old version kept it. Never overwrites a live copy. */
export function restoreRetiredLegacyState(): boolean {
  try {
    const retired = readRetiredLegacyState();
    if (retired == null || window.localStorage.getItem(LEGACY_KEY) != null) return false;
    window.localStorage.setItem(LEGACY_KEY, retired.raw);
    window.localStorage.removeItem(RETIRED_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Permanently delete the legacy copies on this device (explicit Settings action only). */
export function deleteLegacyCopies(which: 'live' | 'retired' | 'both'): void {
  try {
    if (which !== 'retired') window.localStorage.removeItem(LEGACY_KEY);
    if (which !== 'live') window.localStorage.removeItem(RETIRED_KEY);
  } catch {
    // Storage unavailable: nothing was deleted, and the UI re-reads the state.
  }
}
