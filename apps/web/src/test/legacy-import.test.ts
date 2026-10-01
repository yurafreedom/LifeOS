import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteLegacyCopies,
  readLegacyDecision,
  readLegacyLocalState,
  readRetiredLegacyState,
  recordLegacyDecision,
  restoreRetiredLegacyState,
  retireLegacyState,
} from '../repositories/legacyLocalImport';

afterEach(() => vi.unstubAllGlobals());

function storageWith(raw: string | null) {
  return {
    getItem: vi.fn().mockReturnValue(raw),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

describe('legacy local import', () => {
  it('classifies absent, valid and malformed data', () => {
    const storage = storageWith(null);
    vi.stubGlobal('window', { localStorage: storage });
    expect(readLegacyLocalState()).toEqual({ kind: 'absent' });
    storage.getItem.mockReturnValueOnce('{"version":2}');
    expect(readLegacyLocalState()).toMatchObject({ kind: 'valid', payload: { version: 2 } });
    storage.getItem.mockReturnValueOnce('{no');
    expect(readLegacyLocalState()).toMatchObject({ kind: 'invalid', reason: 'invalid_json' });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('surfaces denied storage access', () => {
    vi.stubGlobal('window', { localStorage: { getItem() { throw new Error('denied'); } } });
    expect(readLegacyLocalState()).toEqual({ kind: 'invalid', raw: null, reason: 'storage_unavailable' });
  });

  it('writes only the user-scoped acknowledged decision marker', () => {
    const storage = storageWith('{"version":2}');
    vi.stubGlobal('window', { localStorage: storage });
    recordLegacyDecision('user-1', 'imported', 1);
    expect(storage.setItem).toHaveBeenCalledWith(
      'lifeOsLegacyDecision:user-1',
      JSON.stringify({ decision: 'imported', revision: 1 }),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

function realStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe('legacy local data · JENKIN S1 ownership rules', () => {
  it('a recorded decision is per account and respected', () => {
    const storage = realStorage({ lifeOsState: '{"version":2}' });
    vi.stubGlobal('window', { localStorage: storage });
    expect(readLegacyDecision('user-a')).toBeNull();
    recordLegacyDecision('user-a', 'fresh', 1);
    expect(readLegacyDecision('user-a')).toEqual({ decision: 'fresh', revision: 1 });
    // Another account has not decided: it is asked separately, never inherits A's answer.
    expect(readLegacyDecision('user-b')).toBeNull();
    // Declining never touches the copy.
    expect(storage.data.get('lifeOsState')).toBe('{"version":2}');
  });

  it('import retires the copy recoverably instead of deleting it', () => {
    const storage = realStorage({ lifeOsState: '{"version":2,"tasks":[]}' });
    vi.stubGlobal('window', { localStorage: storage });
    expect(retireLegacyState('imported')).toBe(true);
    expect(readLegacyLocalState()).toEqual({ kind: 'absent' });
    expect(readRetiredLegacyState()).toMatchObject({ raw: '{"version":2,"tasks":[]}', reason: 'imported' });
    expect(restoreRetiredLegacyState()).toBe(true);
    expect(readLegacyLocalState()).toMatchObject({ kind: 'valid', raw: '{"version":2,"tasks":[]}' });
    expect(readRetiredLegacyState()).toBeNull();
  });

  it('restoring never overwrites a live copy, and deletion is explicit and scoped', () => {
    const storage = realStorage({
      lifeOsState: 'live',
      lifeOsStateRetired: JSON.stringify({ raw: 'old', retired_at: 'x', reason: 'imported' }),
    });
    vi.stubGlobal('window', { localStorage: storage });
    expect(restoreRetiredLegacyState()).toBe(false);
    expect(storage.data.get('lifeOsState')).toBe('live');
    deleteLegacyCopies('retired');
    expect(storage.data.has('lifeOsStateRetired')).toBe(false);
    expect(storage.data.get('lifeOsState')).toBe('live');
  });
});
