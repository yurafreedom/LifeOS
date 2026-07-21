import { describe, expect, it } from 'vitest';
import { buildInitialState, migrateStateCopy } from '../context/LifeDataContext.jsx';

describe('state migration', () => {
  it('returns a valid cloned v2 state without mutating the source', () => {
    const source = buildInitialState() as Record<string, any>;
    const before = JSON.stringify(source);
    const migrated = migrateStateCopy(source);
    expect(migrated).not.toBe(source);
    expect(migrated.version).toBe(2);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('migrates a known versionless v1 shape', () => {
    const source = buildInitialState() as Record<string, any>;
    delete source.version;
    source.transactions = [];
    source.habits = {};
    const migrated = migrateStateCopy(source);
    expect(migrated.version).toBe(2);
    expect(migrated.transactions.length).toBeGreaterThan(0);
    expect(migrated.habits).toHaveLength(4);
  });

  it('rejects unsupported newer versions and malformed collections', () => {
    expect(() => migrateStateCopy({ ...buildInitialState(), version: 3 })).toThrow(/newer/i);
    expect(() => migrateStateCopy({ ...buildInitialState(), tasks: {} })).toThrow(/tasks/i);
  });

  it('preserves legacy literal habit names as a fallback', () => {
    const source = buildInitialState() as Record<string, any>;
    source.habits = [{ id: 'legacy', name: 'Read', week: [1, 0, 0, 0, 0, 0, 0], streak: 1, best: 1 }];
    const migrated = migrateStateCopy(source);
    expect(migrated.habits[0]).toMatchObject({ id: 'legacy', name: 'Read' });
  });
});
