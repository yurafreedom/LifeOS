import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { MAX_YEAR, todayDateOnly } from '../domain/calendarModel.ts';
import CalendarPage, { CalendarView } from '../pages/calendar/CalendarPage.jsx';
import { DayCubes } from '../pages/calendar/CubeGrids.jsx';

/* Calendar cube UI (plan C03, C04, C05, C10, C20, C21, C35). */

const bounds = { today: '2026-10-14', currentYear: 2026, minYear: 2026, maxYear: MAX_YEAR };

function withLocale(node, locale = 'ru', state = { tasks: [] }) {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ t, locale, themeEff: 'dark' }}>
      <LifeDataContext.Provider value={{ state }}>{node}</LifeDataContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}

function view(target, locale = 'ru') {
  const t = LifeMakeT(locale);
  const intl = LifeStrings[locale]._intl_locale;
  return withLocale(<CalendarView view={{ valid: true, ...target }} bounds={bounds} intl={intl} t={t} onNavigate={() => {}} />, locale);
}

const cubes = html => html.match(/<button[^>]*class="cal-cube[^"]*"[^>]*>.*?<\/button>/g) || [];

describe('day cubes', () => {
  it.each([[2026, 2, 28], [2028, 2, 29], [2026, 4, 30], [2026, 10, 31]])(
    'C01/C03 · %i-%i renders exactly %i cubes with number + weekday only', (year, month, count) => {
      const html = view({ view: 'month', year, month, day: null });
      const buttons = cubes(html);
      expect(buttons).toHaveLength(count);
      for (const button of buttons) {
        const inner = button.replace(/^<button[^>]*>/, '').replace(/<\/button>$/, '');
        expect(inner).toMatch(/^<span class="cal-cube-num">\d{1,2}<\/span><span class="cal-cube-dow mono">[^<]{1,4}<\/span>$/);
      }
    });

  it('C04 · no task text, pill or seed content inside the grid', () => {
    const today = todayDateOnly();
    const html = withLocale(<CalendarPage />, 'ru', {
      tasks: [{ id: 1, title: 'СЕКРЕТНАЯ ЗАДАЧА', done: false, schedule: { date: today, time: '09:00' } }],
    });
    expect(cubes(html).length).toBeGreaterThanOrEqual(28);
    expect(html).not.toContain('СЕКРЕТНАЯ ЗАДАЧА');
    expect(html).not.toContain('cal-pill');
    expect(html).not.toContain('09:00');
    expect(html).not.toMatch(/дейли|терапия|кормление пса|тихий день/);
  });

  it('C05 · each cube opens its own date and is labelled with the full date', () => {
    const opened = [];
    const t = LifeMakeT('ru');
    const tree = DayCubes({ year: 2026, month: 10, today: '2026-10-14', intl: 'ru-RU', t, onOpen: date => opened.push(date) });
    const items = tree.props.children;
    expect(items).toHaveLength(31);
    items[13].props.children.props.onClick();
    items[0].props.children.props.onClick();
    expect(opened).toEqual(['2026-10-14', '2026-10-01']);
    const html = view({ view: 'month', year: 2026, month: 10, day: null });
    expect(html).toContain('data-date="2026-10-14"');
    expect(html).toMatch(/aria-label="среда, 14 октября 2026[^"]*, сегодня"/);
    expect(html).toContain('aria-current="date"');
  });
});

describe('month and year levels', () => {
  it('shows the 12 months of a year', () => {
    const html = view({ view: 'year', year: 2027 });
    expect(cubes(html)).toHaveLength(12);
    expect(html).toContain('январь');
    expect(html).toContain('декабрь');
  });

  it('C10 · 30 years per window, the last window capped at 2100', () => {
    expect(cubes(view({ view: 'years', year: 2026 }))).toHaveLength(30);
    const last = view({ view: 'years', year: 2090 });
    expect(cubes(last)).toHaveLength(15);
    expect(last).toContain('data-year="2100"');
    expect(last).not.toContain('data-year="2101"');
  });
});

describe('C20 / C21 · localisation', () => {
  it('renders Russian month, weekday and level copy', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null }, 'ru');
    expect(html).toContain('октябрь 2026');
    expect(html).toContain('>дни<');
    expect(html).toContain('>история<');
  });

  it('renders Ukrainian month, weekday and level copy', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null }, 'uk');
    expect(html).toContain('жовтень 2026');
    expect(html).toContain('>дні<');
    expect(html).toContain('>історія<');
    expect(html).toContain('>пн<');
  });

  it('defines every cal_ key in both dictionaries', () => {
    const ru = Object.keys(LifeStrings.ru).filter(key => key.startsWith('cal_')).sort();
    const uk = Object.keys(LifeStrings.uk).filter(key => key.startsWith('cal_')).sort();
    expect(uk).toEqual(ru);
    expect(ru.some(key => key.startsWith('cal_seed_'))).toBe(false);
  });
});

describe('C35 · no fabricated Calendar data', () => {
  it('removed the seed pool, the weekly aggregator and the pill view', () => {
    for (const file of ['../data/calendar-seed.js', '../lib/calendar.js', '../components/CalendarView.jsx', '../pages/calendar/DayDetailModal.jsx']) {
      expect(existsSync(new URL(file, import.meta.url))).toBe(false);
    }
  });

  it('builds the Calendar from state.tasks only — no dog feedings or seeds', () => {
    for (const file of ['CalendarPage.jsx', 'CubeGrids.jsx']) {
      const source = readFileSync(new URL(`../pages/calendar/${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/calendar-seed|LifeCalendarSeed|feeding|meals|state\.dog/);
    }
  });
});
