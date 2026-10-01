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

  it('migrates a known versionless v1 shape without fabricating demo content', () => {
    const source = buildInitialState() as Record<string, any>;
    delete source.version;
    source.transactions = [];
    source.habits = {};
    delete source.goals;
    const migrated = migrateStateCopy(source);
    expect(migrated.version).toBe(2);
    // JENKIN S1: migration used to reseed 15 demo transactions, 3 goals and 4
    // habits into real accounts. Absent or empty now stays empty.
    expect(migrated.transactions).toEqual([]);
    expect(migrated.habits).toEqual([]);
    expect(migrated.goals).toEqual([]);
  });

  it('rejects unsupported newer versions and malformed collections', () => {
    expect(() => migrateStateCopy({ ...buildInitialState(), version: 3 })).toThrow(/newer/i);
    expect(() => migrateStateCopy({ ...buildInitialState(), tasks: {} })).toThrow(/tasks/i);
    expect(() => migrateStateCopy({ ...buildInitialState(), projects: {} })).toThrow(/projects/i);
    expect(() => migrateStateCopy({ ...buildInitialState(), waitingItems: {} }))
      .toThrow(/waitingItems/i);
    expect(() => migrateStateCopy({ ...buildInitialState(), references: 'nope' }))
      .toThrow(/references/i);
  });

  /* ── Clarify · additive waitingItems[] + references[] ───────────────── */

  it('loads an old v2 snapshot that predates Clarify and seeds the new arrays to []', () => {
    const source = buildInitialState() as Record<string, any>;
    delete source.waitingItems;
    delete source.references;
    const before = structuredClone(source);

    const migrated = migrateStateCopy(source);

    expect(migrated).toEqual({ ...before, waitingItems: [], references: [] });
    expect(migrated.version).toBe(2);
    /* Nothing else moved, and the input object is never mutated. */
    expect(source).toEqual(before);
    expect(source.waitingItems).toBeUndefined();
    expect(source.references).toBeUndefined();
  });

  it('preserves valid existing Waiting and Reference records byte-for-byte', () => {
    const waiting = {
      id: 'waiting-existing',
      title: 'счёт от подрядчика',
      waiting_for: 'Аня',
      created_at: '2026-09-20T09:14:00.000Z',
    };
    const reference = {
      id: 'reference-existing',
      text: 'ссылка на статью про CYP2D6',
      created_at: '2026-09-21T11:02:00.000Z',
    };
    const source = {
      ...buildInitialState(),
      waitingItems: [waiting],
      references: [reference],
    } as Record<string, any>;

    const migrated = migrateStateCopy(source);

    expect(migrated.waitingItems).toEqual([waiting]);
    expect(migrated.references).toEqual([reference]);
    expect(migrated.waitingItems[0]).not.toBe(waiting);
    expect(migrated.references[0]).not.toBe(reference);
    expect(migrated.version).toBe(2);
  });

  it('accepts a Waiting record with the optional counterparty absent', () => {
    const source = {
      ...buildInitialState(),
      waitingItems: [{
        id: 'waiting-bare',
        title: 'ответ из банка',
        created_at: '2026-09-20T09:14:00.000Z',
      }],
    } as Record<string, any>;

    expect(migrateStateCopy(source).waitingItems).toEqual([{
      id: 'waiting-bare',
      title: 'ответ из банка',
      created_at: '2026-09-20T09:14:00.000Z',
    }]);
  });

  it('rejects malformed Waiting and Reference records instead of silently dropping them', () => {
    expect(() => migrateStateCopy({
      ...buildInitialState(),
      waitingItems: [{ id: 'w', title: '   ', created_at: '2026-09-20T09:14:00.000Z' }],
    })).toThrow(/Waiting item title/i);
    expect(() => migrateStateCopy({
      ...buildInitialState(),
      waitingItems: ['nope'],
    })).toThrow(/Waiting item data/i);
    expect(() => migrateStateCopy({
      ...buildInitialState(),
      references: [{ id: 'r', text: 'x', created_at: 'not-a-date' }],
    })).toThrow(/Reference timestamp/i);
  });

  it('ships both collections empty in a fresh snapshot and keeps state version 2', () => {
    const fresh = migrateStateCopy(buildInitialState()) as Record<string, any>;
    expect(fresh.waitingItems).toEqual([]);
    expect(fresh.references).toEqual([]);
    expect(fresh.version).toBe(2);
  });

  it('preserves legacy literal habit names as a fallback', () => {
    const source = buildInitialState() as Record<string, any>;
    source.habits = [{ id: 'legacy', name: 'Read', week: [1, 0, 0, 0, 0, 0, 0], streak: 1, best: 1 }];
    const migrated = migrateStateCopy(source);
    expect(migrated.habits[0]).toMatchObject({ id: 'legacy', name: 'Read' });
  });
});

/* ── GTD G1 · Waiting lifecycle fields at the snapshot boundary ───────── */

describe('state migration · Waiting lifecycle (G1)', () => {
  const CREATED = '2026-09-28T09:14:00.000Z';
  const RESOLVED = '2026-09-30T10:00:00.000Z';
  const legacy = { id: 'waiting-legacy', title: 'ответ из банка', waiting_for: null, created_at: CREATED };
  const lifecycle = [
    legacy,
    { id: 'waiting-edited', title: 'счёт', waiting_for: 'Аня', created_at: CREATED, updated_at: RESOLVED },
    { id: 'waiting-received', title: 'документы', waiting_for: 'Олег', created_at: CREATED,
      resolution: 'received', resolved_at: RESOLVED, updated_at: RESOLVED },
    { id: 'waiting-cancelled', title: 'звонок', waiting_for: null, created_at: CREATED,
      resolution: 'cancelled', resolved_at: RESOLVED, updated_at: RESOLVED },
    { id: 'waiting-converted', title: 'договор', waiting_for: 'Ира', created_at: CREATED,
      resolution: 'converted', resolved_at: RESOLVED, converted_task_id: 1_900_000_000_000, updated_at: RESOLVED },
  ];

  it('loads a legacy four-field Waiting snapshot unchanged', () => {
    const source = { ...buildInitialState(), waitingItems: [legacy] } as Record<string, any>;
    const before = structuredClone(source);
    const migrated = migrateStateCopy(source);
    expect(migrated).toEqual(before);
    expect(Object.keys(migrated.waitingItems[0]).sort()).toEqual(['created_at', 'id', 'title', 'waiting_for']);
  });

  it('round-trips every lifecycle shape through the server JSON body and a reload, leaving other collections intact', () => {
    const source = {
      ...buildInitialState(),
      waitingItems: lifecycle,
      references: [{ id: 'reference-1', text: 'пароль от роутера на коробке', created_at: CREATED }],
      projects: [{ id: 'project-1', title: 'ремонт', created_at: CREATED, started_at: CREATED, status: 'active' }],
    } as Record<string, any>;
    const first = migrateStateCopy(source);
    /* PUT /api/v1/state stores `payload` as JSON; GET returns it; the client migrates again. */
    const reloaded = migrateStateCopy(JSON.parse(JSON.stringify({ payload: first })).payload);
    expect(reloaded).toEqual(source);
    expect(reloaded.version).toBe(2);
  });

  it('rejects a malformed lifecycle field instead of dropping it', () => {
    const broken = { ...legacy, resolution: 'converted', resolved_at: RESOLVED };
    expect(() => migrateStateCopy({ ...buildInitialState(), waitingItems: [broken] }))
      .toThrow(/must link its task/);
    expect(() => migrateStateCopy({ ...buildInitialState(), waitingItems: [{ ...legacy, resolution: 'done', resolved_at: RESOLVED }] }))
      .toThrow(/resolution is invalid/);
  });
});
