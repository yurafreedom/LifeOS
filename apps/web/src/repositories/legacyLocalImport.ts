export type LegacyReadResult =
  | { kind: 'absent' }
  | { kind: 'valid'; payload: unknown; raw: string }
  | { kind: 'invalid'; raw: string | null; reason: string };

export function readLegacyLocalState(): LegacyReadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem('lifeOsState');
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

export function recordLegacyDecision(
  userId: string,
  decision: 'imported' | 'fresh',
  revision: number,
): void {
  try {
    window.localStorage.setItem(
      `lifeOsLegacyDecision:${userId}`,
      JSON.stringify({ decision, revision }),
    );
  } catch {
    // The marker is diagnostic only and must never block acknowledged server state.
  }
}
