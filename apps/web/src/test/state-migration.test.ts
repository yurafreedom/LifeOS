import { describe, expect, it } from 'vitest';
import { buildInitialState, migrateStateCopy } from '../context/LifeDataContext.jsx';

describe('state migration', () => {
  it('returns a valid cloned v2 state without mutating the source', () => {
    const source = buildInitialState() as Record<string, any>;
    const before = JSON.stringify(source);
    const migrated = migrateStateCopy(source);
    expect(migrated).not.toBe(source);
    expect(migrated.version).toBe(2);
    expect(migrated.projects).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('additively seeds projects for an existing v2 snapshot without changing its fields', () => {
    const source = buildInitialState() as Record<string, any>;
    delete source.projects;
    const before = structuredClone(source);

    const migrated = migrateStateCopy(source);

    expect(migrated).toEqual({ ...before, projects: [] });
    expect(migrated.version).toBe(2);
    expect(source).toEqual(before);
  });

  it('preserves a canonical Project unchanged during migration', () => {
    const project = {
      id: 'project-preserved',
      title: 'Запуск LifeOS',
      created_at: '2026-08-01T09:00:00.000Z',
      started_at: '2026-08-01T09:00:00.000Z',
      status: 'completed',
      current_forecast_date: '2026-08-24',
      completed_at: '2026-08-25T18:15:00.000Z',
    };
    const source = { ...buildInitialState(), projects: [project] } as Record<string, any>;

    const migrated = migrateStateCopy(source);

    expect(migrated.projects).toEqual([project]);
    expect(migrated.projects[0]).not.toBe(project);
    expect(migrated.version).toBe(2);
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
    expect(() => migrateStateCopy({ ...buildInitialState(), projects: {} })).toThrow(/projects/i);
  });

  it('preserves legacy literal habit names as a fallback', () => {
    const source = buildInitialState() as Record<string, any>;
    source.habits = [{ id: 'legacy', name: 'Read', week: [1, 0, 0, 0, 0, 0, 0], streak: 1, best: 1 }];
    const migrated = migrateStateCopy(source);
    expect(migrated.habits[0]).toMatchObject({ id: 'legacy', name: 'Read' });
  });
});
