import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLegacyLocalState, recordLegacyDecision } from '../repositories/legacyLocalImport';

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
