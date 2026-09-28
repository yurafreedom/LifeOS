import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import {
  PROJECT_TIME_ZONE,
  projectCompletionQueueRequest,
  projectForecastQueueRequest,
} from '../analytics/projectFacts';
import { dateOnlyAfterEndOfDay } from '../analytics/timezone';
import {
  PROJECT_STATUSES,
  archiveProjectRecord,
  completeProjectWithDurableIntent,
  createProjectRecord,
  setProjectForecastWithDurableIntent,
  validateProjectRecord,
} from '../domain/projects';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue';

const PROJECT = createProjectRecord(
  '  Запуск LifeOS  ',
  '2026-08-01T09:00:00.000Z',
  'project-lifeos',
);

describe('minimal Project domain', () => {
  it('creates a distinct active Project without an analytics dependency', () => {
    expect(PROJECT).toEqual({
      id: 'project-lifeos',
      title: 'Запуск LifeOS',
      created_at: '2026-08-01T09:00:00.000Z',
      started_at: '2026-08-01T09:00:00.000Z',
      status: 'active',
      current_forecast_date: null,
      completed_at: null,
    });
    expect(() => createProjectRecord('   ')).toThrow(/title/i);
    expect([...PROJECT_STATUSES]).toEqual(['active', 'completed', 'archived']);
  });

  it('builds the exact append-only forecast semantic payload and IANA-safe horizon', () => {
    const request = projectForecastQueueRequest(PROJECT, '2026-08-20');
    expect(request).toEqual({
      operation_type: 'forecast.append',
      route: '/api/v1/aa/forecasts',
      payload: {
        subject: { domain: 'project', type: 'project', id: 'project-lifeos' },
        metric_key: 'project.completion_date',
        value: { type: 'date', date: '2026-08-20' },
        horizon_at: '2026-08-20T21:00:00.000Z',
        provenance: {
          source_kind: 'USER_REPORTED',
          basis: 'Прогноз завершения проекта пользователя',
          method: 'MANUAL_FORECAST',
        },
      },
    });
  });

  it.each([
    ['spring before DST', '2026-03-28', '2026-03-28T22:00:00.000Z'],
    ['spring after DST', '2026-03-29', '2026-03-29T21:00:00.000Z'],
    ['autumn after DST', '2026-10-25', '2026-10-25T22:00:00.000Z'],
    ['year boundary', '2026-12-31', '2026-12-31T22:00:00.000Z'],
  ])('resolves the next local midnight across %s', (_case, dateOnly, expected) => {
    expect(dateOnlyAfterEndOfDay(dateOnly, PROJECT_TIME_ZONE)).toBe(expected);
  });

  it('mutates forecast state only after durable enqueue and preserves it on failure', async () => {
    let resolveEnqueue!: (value: unknown) => void;
    const enqueue = vi.fn(() => new Promise(resolve => { resolveEnqueue = resolve; }));
    let settled = false;
    const pending = setProjectForecastWithDurableIntent(PROJECT, '2026-08-20', enqueue)
      .then(value => { settled = true; return value; });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(PROJECT.current_forecast_date).toBeNull();
    resolveEnqueue({ queue_id: 1 });
    await expect(pending).resolves.toMatchObject({ current_forecast_date: '2026-08-20' });

    await expect(setProjectForecastWithDurableIntent(
      PROJECT,
      '2026-08-24',
      async () => { throw new Error('IndexedDB unavailable'); },
    )).rejects.toThrow('IndexedDB unavailable');
    await expect(setProjectForecastWithDurableIntent(
      PROJECT,
      '2026-08-24',
      async () => null,
    )).rejects.toThrow(/durably queued/i);
    expect(PROJECT.current_forecast_date).toBeNull();
  });

  it('records three forecast versions and one separate actual Measurement intent', async () => {
    const factory = new IDBFactory();
    let sequence = 0;
    const queue = new AnalyticsWriteQueue(
      factory,
      () => `project-forecast-key-${++sequence}`,
      'slice-p-forecast-history',
    );
    let current = PROJECT;
    for (const date of ['2026-08-20', '2026-08-24', '2026-08-26']) {
      current = await setProjectForecastWithDurableIntent(current, date, async (project, value) => {
        const request = projectForecastQueueRequest(project, value);
        return queue.enqueue({
          user_id: 'owner',
          operation_type: request.operation_type,
          route: request.route,
          payload: request.payload,
        });
      });
    }

    const completionInstant = '2026-08-24T21:30:00.000Z';
    const completed = await completeProjectWithDurableIntent(
      current,
      completionInstant,
      async (project, instant) => {
        const request = projectCompletionQueueRequest(project, instant);
        return queue.enqueue({
          user_id: 'owner',
          operation_type: request.operation_type,
          route: request.route,
          payload: request.payload,
        });
      },
    );

    const writes = await queue.list('owner');
    const forecasts = writes.filter(write => write.operation_type === 'forecast.append');
    const actuals = writes.filter(write => write.operation_type === 'measurement.append');
    expect(forecasts).toHaveLength(3);
    expect(actuals).toHaveLength(1);
    expect(forecasts.map(write => (write.payload.value as { date: string }).date)).toEqual([
      '2026-08-20', '2026-08-24', '2026-08-26',
    ]);
    expect(actuals[0]).toMatchObject({
      route: '/api/v1/aa/measurements',
      payload: { value: { type: 'date', date: '2026-08-25' }, occurred_at: completionInstant },
    });
    expect(actuals[0].payload).not.toHaveProperty('horizon_at');
    expect(new Set(writes.map(write => write.idempotency_key)).size).toBe(4);
    expect(current.current_forecast_date).toBe('2026-08-26');
    expect(completed).toMatchObject({ status: 'completed', completed_at: completionInstant });
    queue.close();
  });

  it('stores actual completion separately as an observed Measurement at the real instant', async () => {
    const completedAt = '2026-08-24T21:30:45.000Z';
    const request = projectCompletionQueueRequest(PROJECT, completedAt);
    expect(request).toEqual({
      operation_type: 'measurement.append',
      route: '/api/v1/aa/measurements',
      payload: {
        subject: { domain: 'project', type: 'project', id: 'project-lifeos' },
        metric_key: 'project.completion_date',
        value: { type: 'date', date: '2026-08-25' },
        occurred_at: completedAt,
        occurred_tz: 'Europe/Kyiv',
        provenance: {
          source_kind: 'OBSERVED',
          basis: 'Фактическое завершение проекта',
          method: 'PROJECT_COMPLETION',
        },
      },
    });
    expect(request.payload).not.toHaveProperty('horizon_at');

    const completed = await completeProjectWithDurableIntent(
      PROJECT,
      completedAt,
      async () => ({ queue_id: 4 }),
    );
    expect(completed).toMatchObject({ status: 'completed', completed_at: completedAt });
    expect(PROJECT).toMatchObject({ status: 'active', completed_at: null });
  });

  it('preserves active snapshot state when completion enqueue fails', async () => {
    await expect(completeProjectWithDurableIntent(
      PROJECT,
      '2026-08-25T18:00:00.000Z',
      async () => { throw new Error('queue failed'); },
    )).rejects.toThrow('queue failed');
    expect(PROJECT).toMatchObject({ status: 'active', completed_at: null });
  });

  it('archives active and completed Projects without losing forecast or completion facts', async () => {
    const forecasted = { ...PROJECT, current_forecast_date: '2026-08-26' };
    expect(archiveProjectRecord(forecasted)).toMatchObject({
      status: 'archived', current_forecast_date: '2026-08-26', completed_at: null,
    });
    const completed = {
      ...forecasted,
      status: 'completed' as const,
      completed_at: '2026-08-25T18:00:00.000Z',
    };
    expect(archiveProjectRecord(completed)).toMatchObject({
      status: 'archived',
      current_forecast_date: '2026-08-26',
      completed_at: '2026-08-25T18:00:00.000Z',
    });
    const archived = archiveProjectRecord(forecasted);
    expect(() => archiveProjectRecord(archived)).toThrow(/active or completed/i);
    expect(() => validateProjectRecord({ ...PROJECT, status: 'paused' })).toThrow(/status/i);
    await expect(setProjectForecastWithDurableIntent(
      archived, '2026-09-01', async () => ({ queue_id: 5 }),
    )).rejects.toThrow(/active/i);
    await expect(completeProjectWithDurableIntent(
      archived, '2026-08-25T18:00:00.000Z', async () => ({ queue_id: 6 }),
    )).rejects.toThrow(/active/i);
  });

});
