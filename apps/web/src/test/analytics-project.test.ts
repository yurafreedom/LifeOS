import { describe, expect, it, vi } from 'vitest';

import {
  countPendingProjectWrites,
  deltaDays,
  formatDateOnly,
  formatDayDelta,
  parseProjectAnalyticsHash,
  projectAnalyticsHash,
} from '../analytics/projectAnalytics';
import { formatDelta } from '../analytics/delta';
import { projectCompletionQueueRequest, projectForecastQueueRequest } from '../analytics/projectFacts';
import { readRouteFromHash } from '../app/routeRegistry.js';
import { LifeMakeT } from '../context/LocaleContext.jsx';
import { AnalyticsRepository } from '../repositories/analyticsRepository';

const days = (n: number) => ({ state: 'known' as const, type: 'duration' as const, num: String(n * 1440), unit_code: 'minute' });

describe('Project Analytics · routing', () => {
  it('builds and parses a deep link that the registry dispatches', () => {
    const hash = projectAnalyticsHash('project-1f3c');
    expect(hash).toBe('#/project-analytics/project-1f3c');
    expect(parseProjectAnalyticsHash(hash)).toBe('project-1f3c');
    expect(readRouteFromHash(hash)).toBe('project-analytics');
  });

  it('round-trips an id that needs encoding and refuses anything else', () => {
    expect(parseProjectAnalyticsHash(projectAnalyticsHash('p 1/ä'))).toBe('p 1/ä');
    expect(parseProjectAnalyticsHash('#/project-analytics/')).toBeNull();
    expect(parseProjectAnalyticsHash('#/project-analytics/a/b')).toBeNull();
    expect(parseProjectAnalyticsHash('#/project-analytics/a%3Ab')).toBeNull();
    expect(parseProjectAnalyticsHash('#/project-analytics/%E0%A4%A')).toBeNull();
    expect(parseProjectAnalyticsHash('#/projects/project-1')).toBeNull();
    expect(() => projectAnalyticsHash('a:b')).toThrow(TypeError);
    expect(() => projectAnalyticsHash('')).toThrow(TypeError);
  });
});

describe('Project Analytics · day deltas', () => {
  it('formats the canonical +5 / −1 in Russian with plural agreement and U+2212', () => {
    const t = LifeMakeT('ru');
    expect(formatDayDelta(days(5), t)).toBe('+5 дней');
    expect(formatDayDelta(days(-1), t)).toBe('−1 день');
    expect(formatDayDelta(days(2), t)).toBe('+2 дня');
    expect(formatDayDelta(days(-11), t)).toBe('−11 дней');
    expect(formatDayDelta(days(21), t)).toBe('+21 день');
    expect(formatDayDelta(days(0), t)).toBe('0 дней');
    expect(formatDayDelta(days(-1), t)!.charCodeAt(0)).toBe(0x2212);
  });

  it('formats the canonical +5 / −1 in Ukrainian', () => {
    const t = LifeMakeT('uk');
    expect(formatDayDelta(days(5), t)).toBe('+5 днів');
    expect(formatDayDelta(days(-1), t)).toBe('−1 день');
    expect(formatDayDelta(days(3), t)).toBe('+3 дні');
  });

  it('has no answer for an unknown delta — never zero', () => {
    const unknown = { state: 'unknown' as const, reason: 'operand_absent' };
    expect(deltaDays(unknown)).toBeNull();
    expect(formatDayDelta(unknown, LifeMakeT('ru'))).toBeNull();
    expect(formatDayDelta(null)).toBeNull();
    // Without a locale the helper still agrees in Russian.
    expect(formatDayDelta(days(-1))).toBe('−1 день');
  });

  it('leaves the shared formatter used by Finance and Review byte-identical', () => {
    expect(formatDelta(days(-1), true)).toBe('−1 дней');
    expect(formatDelta({ state: 'known', type: 'money', num: '-800', unit_code: 'UAH' })).toBe('−₴800');
  });

  it('shows date-only values without a timezone shift', () => {
    expect(formatDateOnly('2026-08-25', 'ru-RU')).toContain('25');
    expect(formatDateOnly('2026-08-25', 'uk-UA')).toContain('25');
    expect(formatDateOnly(null)).toBe('');
  });
});

describe('Project Analytics · pending local writes', () => {
  const project = { id: 'project-1f3c' };
  const records = [
    projectForecastQueueRequest(project, '2026-08-26'),
    projectCompletionQueueRequest(project, '2026-08-25T12:00:00Z'),
    projectForecastQueueRequest({ id: 'project-other' }, '2026-08-26'),
    { operation_type: 'measurement.append', payload: { subject: { domain: 'finance', type: 'transaction', id: 'project-1f3c' } } },
    { operation_type: 'review.save', payload: { subject: 'project:project:project-1f3c' } },
  ];

  it('counts only this project\'s forecast and completion writes', () => {
    expect(countPendingProjectWrites(records, 'project-1f3c')).toBe(2);
    expect(countPendingProjectWrites(records, 'project-other')).toBe(1);
    expect(countPendingProjectWrites([], 'project-1f3c')).toBe(0);
  });
});

describe('Project Analytics · repository read', () => {
  it('reads one GET with an optional as_of and refuses a colon id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ state: 'no_facts' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const repository = new AnalyticsRepository();
      await repository.readProjectAnalytics('project-1f3c');
      await repository.readProjectAnalytics('project-1f3c', { asOf: '2026-08-17T12:00:00+00:00' });
      const urls = fetchMock.mock.calls.map(call => String((call as unknown[])[0]));
      expect(urls[0]).toBe('/api/v1/aa/projects/project-1f3c/analytics');
      expect(urls[1]).toBe('/api/v1/aa/projects/project-1f3c/analytics?as_of=2026-08-17T12%3A00%3A00%2B00%3A00');
      for (const call of fetchMock.mock.calls) {
        expect(((call as unknown[])[1] as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
      }
      expect(() => repository.readProjectAnalytics('a:b')).toThrow(TypeError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
