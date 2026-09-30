import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { calendarBoundsForDay } from '../domain/calendarModel.ts';
import CalendarPage, { CalendarView } from '../pages/calendar/CalendarPage.jsx';

/* Audit follow-up · the Calendar follows the live Europe/Kyiv day.
 *
 * CalendarPage used to memoise its bounds on `tasks` only, so "today" froze
 * until the task list changed. It now reads useKyivToday() (re-rendered at
 * Kyiv midnight and on tab return). The hook is mocked here to a controllable
 * day; the task array stays the SAME object across renders. */

const day = vi.hoisted(() => ({ value: '2026-09-30' }));
vi.mock('../app/useKyivToday.js', () => ({ useKyivToday: () => day.value }));

const TASKS = [{ id: 1, title: 'сдать отчёт', done: false, stakes: false, schedule: { date: '2026-09-30', time: '09:00' } }];
const STATE = { tasks: TASKS };

function page(hash) {
  globalThis.window = { location: { hash } };
  const t = LifeMakeT('ru');
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ t, locale: 'ru', themeEff: 'dark' }}>
      <LifeDataContext.Provider value={{ state: STATE }}><CalendarPage /></LifeDataContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}

const heading = html => (/id="cal-heading"[^>]*>([^<]*)</.exec(html) || [])[1];
/* the day tile / week row marked as today (data-today) and its accessible name */
const todayTile = html => (/data-date="[^"]*" data-today="1"[^>]*aria-label="([^"]*)"/.exec(html) || [])[1];

afterEach(() => { delete globalThis.window; });

describe('Calendar rollover with unchanged tasks', () => {
  it('midnight: today highlight moves to the new Kyiv day', () => {
    day.value = '2026-09-30';
    expect(todayTile(page('#/calendar/2026-09'))).toMatch(/30 сентября 2026.*сегодня, 1 задача$/);
    day.value = '2026-10-01';
    expect(todayTile(page('#/calendar/2026-10'))).toMatch(/1 октября 2026.*сегодня$/);
    /* 30 Sep is no longer today; its active task is now overdue */
    const september = page('#/calendar/2026-09');
    expect(september).not.toMatch(/data-date="2026-09-30" data-today="1"/);
    expect(september).toMatch(/aria-label="среда, 30 сентября 2026[^"]*, 1 задача, просрочено"/);
  });

  it('the undated #/calendar route follows the current Kyiv month', () => {
    day.value = '2026-09-30';
    expect(heading(page('#/calendar'))).toBe('сентябрь 2026');
    day.value = '2026-10-01';
    expect(heading(page('#/calendar'))).toBe('октябрь 2026');
  });

  it('an explicit month route stays put across the rollover', () => {
    day.value = '2026-10-01';
    expect(heading(page('#/calendar/2026-09'))).toBe('сентябрь 2026');
  });

  it('open day details gain the overdue controls after midnight', () => {
    day.value = '2026-09-30';
    const before = page('#/calendar/2026-09-30');
    expect(before).toContain('сдать отчёт');
    expect(before).not.toContain('просрочено');
    day.value = '2026-10-01';
    const after = page('#/calendar/2026-09-30');
    expect(after).toContain('data-level="day"');
    expect(after).toContain('просрочено');
    expect(after).toContain(`>${LifeMakeT('ru')('cal_close_unresolved')}<`);
  });

  it('year boundary: the current-year window and tile move to the new year', () => {
    day.value = '2027-01-01';
    const html = page('#/calendar/years');
    expect(heading(html)).toBe('2027 – 2038');
    expect(html).toMatch(/aria-current="date"[^>]*>(<[^>]*>)*2027</);
  });

  it('year boundary: an explicit route in the year just left stays valid', () => {
    day.value = '2027-01-01';
    const html = page('#/calendar/2026-12-31');
    expect(heading(html)).toMatch(/^четверг, 31 декабря 2026/);
    expect(html).toContain('data-level="day"');
    expect(html).toContain('<span class="cal-crumb" data-level="day" aria-current="page">31</span>');
  });
});

/* Walks a rendered element tree (CalendarView is a hook-free function). */
function findButton(node, text) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) { const hit = findButton(child, text); if (hit) return hit; }
    return null;
  }
  const children = node.props && node.props.children;
  if (node.type === 'button' && children === text) return node;
  return findButton(children, text);
}

describe('Calendar bounds for a live day', () => {
  it('the Today button targets the new Kyiv month once the day rolls over', () => {
    const t = LifeMakeT('ru');
    const onNavigate = vi.fn();
    for (const today of ['2026-12-31', '2027-01-01']) {
      const bounds = calendarBoundsForDay([], today, 2026);
      const tree = CalendarView({ view: { view: 'month', year: 2026, month: 12, day: null }, bounds, intl: 'ru-RU', t, onNavigate });
      findButton(tree, t('cal_today')).props.onClick();
    }
    expect(onNavigate.mock.calls.map(call => call[0])).toEqual([
      { view: 'month', year: 2026, month: 12, day: null },
      { view: 'month', year: 2027, month: 1, day: null },
    ]);
  });

  it('New Year: the current year moves, the year the page opened in stays navigable', () => {
    expect(calendarBoundsForDay([], '2027-01-01', 2026)).toEqual({ today: '2027-01-01', currentYear: 2027, minYear: 2026, maxYear: 2100 });
    /* A fresh load has no such floor (unchanged semantics). */
    expect(calendarBoundsForDay([], '2027-01-01').minYear).toBe(2027);
    /* Dated tasks still open earlier years. */
    expect(calendarBoundsForDay([{ id: 1, schedule: { date: '2024-05-01', time: '' } }], '2027-01-01', 2026).minYear).toBe(2024);
  });
});
