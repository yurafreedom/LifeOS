/**
 * Recoverable unsaved snapshot edits, kept per account on this device.
 *
 * When a tab stops working for an account with edits the server never
 * acknowledged — the session expired, another tab signed in as someone else,
 * or the user signed out choosing to keep a copy — the edits are stored under
 * that account's own key. They are offered back only after signing in to the
 * *same* account, and never replayed automatically: restoring is an explicit
 * compare-and-swap against the revision the edits were based on.
 *
 * Device-local and private: the record lives in this browser profile only, is
 * removed when restored or discarded, and never enters another account.
 */

import type { LifeOsState } from './stateRepository';

const PREFIX = 'lifeOsPendingSnapshot:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PendingReason = 'expired' | 'account_changed' | 'signed_out' | 'page_hidden';

export type PendingSnapshot = {
  format: 1;
  user_id: string;
  base_revision: number;
  saved_at: string;
  reason: PendingReason;
  payload: LifeOsState;
};

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function pendingSnapshotKey(userId: string): string {
  return PREFIX + userId;
}

export function savePendingSnapshot(
  userId: string,
  payload: LifeOsState,
  baseRevision: number,
  reason: PendingReason,
): boolean {
  if (!UUID.test(userId)) return false;
  const record: PendingSnapshot = {
    format: 1,
    user_id: userId,
    base_revision: baseRevision,
    saved_at: new Date().toISOString(),
    reason,
    payload,
  };
  try {
    storage()?.setItem(pendingSnapshotKey(userId), JSON.stringify(record));
    return storage() != null;
  } catch {
    return false;
  }
}

export function readPendingSnapshot(userId: string): PendingSnapshot | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(pendingSnapshotKey(userId)) ?? null;
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    const record = JSON.parse(raw) as PendingSnapshot;
    // The key is not trusted on its own: the record must name the same owner.
    if (
      record?.format !== 1
      || record.user_id !== userId
      || !Number.isInteger(record.base_revision)
      || record.payload == null
      || typeof record.payload !== 'object'
      || record.payload.version !== 2
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export function clearPendingSnapshot(userId: string): void {
  try {
    storage()?.removeItem(pendingSnapshotKey(userId));
  } catch {
    // Nothing else can be done; the record stays bound to its own account.
  }
}
