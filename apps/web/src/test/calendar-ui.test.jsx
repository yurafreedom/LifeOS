import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { MAX_YEAR, todayDateOnly } from '../domain/calendarModel.ts';
import CalendarPage, { CalendarView } from '../pages/calendar/CalendarPage.jsx';
import { DaysGridA } from '../pages/calendar/TileGrids.jsx';

/* Nested tile Calendar (approved JENKIN design): Years → Months → Days (A/B)
   → Day details, History as a separate control, one stable stage. */

const bounds = { today: '2026-10-14', currentYear: 2026, minYear: 2026, maxYear: MAX_YEAR };
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

function withLocale(node, locale = 'ru', state = { tasks: [] }) {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ t, locale, themeEff: 'dark' }}>
      <LifeDataContext.Provider value={{ state }}>{node}</LifeDataContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}

function view(target, { locale = 'ru', tasks = [], layout, cursor = null, b = bounds } = {}) {
  const t = LifeMakeT(locale);
  const intl = LifeStrings[locale]._intl_locale;
  return withLocale(<CalendarView view={{ valid: true, ...target }} bounds={b} intl={intl} t={t} tasks={tasks}
    cursor={cursor} layout={layout} onNavigate={() => {}} onRestore={() => {}} />, locale);
}

const tiles = html => html.match(/<button[^>]*data-tile="1"[^>]*>/g) || [];
const on = (date, time = '') => ({ schedule: { date, time } });
const TASKS = [
  { id: 1, title: 'СЕКРЕТНАЯ ЗАДАЧА', done: false, ...on('2026-10-14', '09:00') },
  { id: 2, title: 'вторая сегодня', done: false, stakes: true, ...on('2026-10-14') },
  { id: 3, title: 'просроченная', done: false, ...on('2026-10-02') },
  { id: 4, title: 'сделанная', done: true, completed_at: '2026-10-05T09:00:00.000Z', ...on('2026-10-05') },
  { id: 5, title: 'архивная', done: false, closure: 'archived', closed_at: '2026-10-06T09:00:00.000Z', ...on('2026-10-06') },
  { id: 6, title: 'без даты', done: false, due: 'eod', stakes: true, tag: 'today' },
  { id: 7, title: 'в декабре', done: false, ...on('2026-12-24') },
  { id: 8, title: 'в 2031', done: false, ...on('2031-03-03') },
];

describe('Years and Months: twelve tiles each', () => {
  it('years: the 12-year window with real task counts and the current year marked', () => {
    const html = view({ view: 'years', year: 2026 }, { tasks: TASKS });
    expect(tiles(html)).toHaveLength(12);
    expect(html).toContain('class="cal-grid cal-grid12 cal-grid-years" data-nav="grid"');
    expect(html).toMatch(/data-year="2026" data-today="1" data-selected="1" data-autofocus="1" aria-current="date" aria-label="2026, 4 задачи"/);
    expect(html).toContain('aria-label="2031, 1 задача"');
    /* a year without active dated tasks stays honestly empty */
    expect(html).toMatch(/data-year="2027"[^>]*aria-label="2027"/);
    expect(html).not.toContain('data-year="2038"');
  });

  it('years: the last window stops at 2100', () => {
    const html = view({ view: 'years', year: 2099 });
    expect(tiles(html)).toHaveLength(3);
    expect(html).toContain('data-year="2100"');
    expect(html).not.toContain('data-year="2101"');
  });

  it('months: the 12 months of the year with counts, the current month marked', () => {
    const html = view({ view: 'year', year: 2026 }, { tasks: TASKS });
    expect(tiles(html)).toHaveLength(12);
    expect(html).toContain('январь');
    expect(html).toContain('декабрь');
    expect(html).toMatch(/data-month="2026-10" data-today="1" data-selected="1" data-autofocus="1" aria-current="date" aria-label="октябрь 2026, 3 задачи"/);
    expect(html).toContain('aria-label="декабрь 2026, 1 задача"');
    const uk = view({ view: 'year', year: 2027 }, { locale: 'uk' });
    expect(uk).toContain('січень');
    expect(uk).toContain('грудень');
  });
});

describe('Days layout A: seven weekday columns × six date rows', () => {
  it('renders 42 date tiles plus seven weekday headers, neighbouring days marked', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null }, { layout: 'A', tasks: TASKS });
    expect(html).toContain('data-layout="A"');
    expect(tiles(html)).toHaveLength(42);
    expect(html.match(/class="cal-wdh"/g)).toHaveLength(7);
    expect(html).toContain('>пн<');
    expect(html).toMatch(/data-date="2026-09-28"[^>]*data-adjacent="1"/);
    expect(html).toMatch(/data-date="2026-11-08"[^>]*data-adjacent="1"/);
    expect(html.match(/data-adjacent="1"/g)).toHaveLength(11);
  });

  it.each([[2026, 2, 28], [2028, 2, 29], [2026, 8, 31]])('%i-%i shows its %i days inside the 42 cells', (year, m, days) => {
    const html = view({ view: 'month', year, month: m, day: null }, { layout: 'A' });
    expect(tiles(html)).toHaveLength(42);
    expect(tiles(html).filter(tile => !tile.includes('data-adjacent'))).toHaveLength(days);
  });

  it('summarises only real active tasks: count text and dots, never titles or times', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null }, { layout: 'A', tasks: TASKS });
    expect(html).not.toContain('СЕКРЕТНАЯ ЗАДАЧА');
    expect(html).not.toContain('09:00');
    expect(html).toMatch(/aria-label="среда, 14 октября 2026[^"]*, сегодня, 2 задачи"/);
    expect(html).toMatch(/aria-label="пятница, 2 октября 2026[^"]*, 1 задача, просрочено"/);
    /* completed / archived / undated tasks are not on any tile */
    expect(html).toMatch(/aria-label="понедельник, 5 октября 2026 г\."/);
    expect(html).toMatch(/aria-label="вторник, 6 октября 2026 г\."/);
    expect(html).toContain('<span class="cal-dots is-overdue" aria-hidden="true"><i></i></span>');
  });

  it('out-of-range neighbouring days are disabled, never navigable', () => {
    const html = view({ view: 'month', year: 2100, month: 12, day: null }, { layout: 'A' });
    expect(html).toMatch(/data-date="2101-01-01"[^>]*disabled=""/);
    expect(html).not.toMatch(/data-date="2100-12-31"[^>]*disabled=""/);
  });

  it('each day tile opens its own date (single activations only)', () => {
    const opened = [];
    const t = LifeMakeT('ru');
    const counts = { day: new Map(), month: new Map(), year: new Map() };
    const tree = DaysGridA({ year: 2026, month: 10, cursor: '2026-10-14', today: '2026-10-14', bounds, counts, intl: 'ru-RU', t, onOpen: date => opened.push(date) });
    const buttons = tree.props.children[1];
    expect(buttons).toHaveLength(42);
    buttons[3].props.onClick({ detail: 1 });
    buttons[0].props.onClick({ detail: 0 });
    buttons[16].props.onClick({ detail: 2 }); // the second click of a double click is ignored
    expect(opened).toEqual(['2026-10-01', '2026-09-28']);
  });
});

describe('Days layout B: week panels (the default)', () => {
  it('is the initial layout', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null });
    expect(html).toContain('data-layout="B"');
    expect(html).toContain('class="cal-grid cal-grid-b" data-nav="weeks"');
    expect(html).toMatch(/aria-pressed="true" aria-label="B · панели недель"/);
    expect(html).toMatch(/aria-pressed="false" aria-label="A · сетка 7×6"/);
  });

  it.each([[2027, 2, 4], [2026, 2, 5], [2028, 2, 5], [2026, 8, 6]])('%i-%i has %i real week panels of seven rows', (year, m, weeks) => {
    const html = view({ view: 'month', year, month: m, day: null });
    expect(html.match(/class="cal-tile cal-week"/g)).toHaveLength(weeks);
    expect(html.match(/class="cal-wrow"/g)).toHaveLength(weeks * 7);
    expect(html).toContain(`>неделя ${weeks}<`);
    expect(html).not.toContain(`>неделя ${weeks + 1}<`);
  });

  it('labels each panel and each row; Ukrainian copy', () => {
    const html = view({ view: 'month', year: 2026, month: 8, day: null }, { locale: 'uk' });
    expect(html).toContain('aria-label="тиждень 1, 27–2"');
    expect(html).toContain('aria-label="тиждень 6, 31–6"');
    expect(html).toMatch(/aria-label="понеділок, 31 серпня 2026/);
  });

  it('switching A/B keeps the route, the selected date, the breadcrumbs and the counts', () => {
    const a = view({ view: 'month', year: 2026, month: 10, day: null }, { layout: 'A', tasks: TASKS, cursor: '2026-10-02' });
    const b = view({ view: 'month', year: 2026, month: 10, day: null }, { layout: 'B', tasks: TASKS, cursor: '2026-10-02' });
    const crumbs = html => html.slice(html.indexOf('<nav class="cal-crumbs"'), html.indexOf('</nav>'));
    expect(crumbs(a)).toBe(crumbs(b));
    for (const html of [a, b]) {
      expect(html).toMatch(/data-date="2026-10-02"[^>]*data-selected="1" data-autofocus="1"/);
      expect(html).toMatch(/aria-label="пятница, 2 октября 2026[^"]*, 1 задача, просрочено"/);
    }
    /* the page's layout switch writes the device preference only — never the hash */
    const page = read('../pages/calendar/CalendarPage.jsx');
    const choose = page.slice(page.indexOf('function chooseLayout'), page.indexOf('const dayActions'));
    expect(choose).toContain('writeLayout(storage(), next);');
    expect(choose).not.toMatch(/hash|setCursor|navigate/);
  });
});

describe('Day details', () => {
  it('lists the active tasks of the day with every Day Manager action — no events', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: '2026-10-14' }, { tasks: TASKS });
    expect(html).toContain('data-level="day"');
    expect(html).toContain('СЕКРЕТНАЯ ЗАДАЧА');
    expect(html).toContain('вторая сегодня');
    expect(html).not.toContain('сделанная');
    expect(html).toMatch(/<h3 class="cal-day-title" id="cal-day-title" tabindex="-1" data-autofocus="1">/);
    expect(html).toContain('>2 задачи<');
    for (const text of ['выполнить: СЕКРЕТНАЯ ЗАДАЧА', '>изменить<', '>в архив<', '>удалить<', '>рутина<', '>важное<', 'data-move="up"', '>добавить задачу<']) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/событи|event/i);
  });

  it('is honestly empty on a day without tasks', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: '2026-10-20' }, { tasks: TASKS });
    expect(html).toContain('на этот день задач нет');
    expect(html).not.toContain('class="cal-task');
  });
});

describe('toolbar: breadcrumbs, layout, period, Today and History are separate controls', () => {
  it('renders a labelled breadcrumb trail with the current level last', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: '2026-10-14' });
    expect(html).toContain('<nav class="cal-crumbs" aria-label="путь в календаре">');
    expect(html).toContain('<button type="button" class="cal-crumb" data-level="years">календарь</button>');
    expect(html).toContain('<button type="button" class="cal-crumb" data-level="months">2026</button>');
    expect(html).toContain('<button type="button" class="cal-crumb" data-level="days">октябрь</button>');
    expect(html).toContain('<span class="cal-crumb" data-level="day" aria-current="page">14</span>');
  });

  it('labels previous / next by level and disables them at the bounds', () => {
    expect(view({ view: 'month', year: 2026, month: 1, day: null })).toMatch(/aria-label="предыдущий месяц" title="предыдущий месяц" disabled=""/);
    expect(view({ view: 'month', year: 2100, month: 12, day: null })).toMatch(/aria-label="следующий месяц" title="следующий месяц" disabled=""/);
    expect(view({ view: 'year', year: 2030 })).toContain('aria-label="следующий год"');
    expect(view({ view: 'years', year: 2030 })).toContain('aria-label="следующие 12 лет"');
    expect(view({ view: 'month', year: 2026, month: 10, day: '2026-10-14' })).toContain('aria-label="следующий день"');
    expect(view({ view: 'month', year: 2026, month: 10, day: null }, { locale: 'uk' })).toContain('aria-label="наступний місяць"');
  });

  it('keeps Today and History at every level; History marks itself pressed', () => {
    for (const target of [{ view: 'years', year: 2026 }, { view: 'year', year: 2026 }, { view: 'month', year: 2026, month: 10, day: null },
      { view: 'month', year: 2026, month: 10, day: '2026-10-14' }, { view: 'history' }]) {
      const html = view(target);
      expect(html).toContain('>сегодня</button>');
      expect(html).toContain('class="cal-tool-btn cal-history-btn"');
    }
    expect(view({ view: 'history' })).toMatch(/class="cal-tool-btn cal-history-btn" aria-pressed="true"/);
    expect(view({ view: 'years', year: 2026 })).toMatch(/class="cal-tool-btn cal-history-btn" aria-pressed="false"/);
  });

  it('announces the period in a polite live heading', () => {
    expect(view({ view: 'month', year: 2026, month: 10, day: null })).toContain('<h3 class="cal-sr-only" id="cal-heading" aria-live="polite">октябрь 2026</h3>');
    expect(view({ view: 'years', year: 2026 })).toContain('id="cal-heading" aria-live="polite">2026 – 2037</h3>');
  });
});

describe('stable stage, responsive columns and motion', () => {
  const css = read('../styles/finance-calendar.css');
  const nav = read('../styles/calendar-nav.css');

  it('sizes one stage 620 px at ≥1024, 560 px at 768–1023 and auto on phones; content scrolls inside', () => {
    expect(css).toContain('@media (min-width: 1024px) { .cal-stage { height: 620px; } }');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1023px) { .cal-stage { height: 560px; } }');
    expect(css).toMatch(/@media \(max-width: 767px\) \{ \.cal-stage \{ height: auto;/);
    expect(css).toMatch(/\.cal-grid \{[^}]*overflow-y: auto; overflow-x: hidden;/);
    expect(nav).toMatch(/\.calendar-page \.cal-panel \{[^}]*container-type: inline-size; container-name: cal;/);
    /* every level renders inside the same .cal-stage element */
    for (const target of [{ view: 'years', year: 2026 }, { view: 'month', year: 2026, month: 10, day: '2026-10-14' }, { view: 'history' }]) {
      expect(view(target).match(/class="cal-stage"/g)).toHaveLength(1);
    }
  });

  it('adapts columns without horizontal overflow: 4 × 3 tiles, B panels 4 → 2 → 1', () => {
    expect(css).toContain('.cal-grid12 { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); }');
    expect(css).toContain('.cal-grid-a { grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(css).toMatch(/\.cal-grid-b \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/@container cal \(max-width: 679px\) \{\s*\.cal-grid-b \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toContain('@container cal (max-width: 419px) { .cal-grid-b { grid-template-columns: minmax(0, 1fr); } }');
  });

  it('uses the approved subtle rotateY(360deg) with a reduced-motion fade, never awaited in code', () => {
    expect(css).toContain('rotateY(360deg)');
    expect(css).toContain('.cal-grid[data-spin="a"] .cal-tile { animation: cal-spin-a 560ms var(--ease); }');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('cal-spin-a')));
    expect(reduced).toContain('.cal-grid[data-spin="a"] .cal-tile { animation: cal-fade-a 180ms var(--ease); }');
    expect(reduced.slice(0, reduced.indexOf('\n}\n'))).not.toContain('rotateY');
    for (const file of ['CalendarPage.jsx', 'TileGrids.jsx', 'DayDetails.jsx', 'calendarNav.js']) {
      expect(read(`../pages/calendar/${file}`)).not.toMatch(/animationend|transitionend|onAnimationEnd/);
    }
  });

  it('keeps the stage text at the 12 px floor: day details meta, History headers, labels and states', () => {
    const rule = selector => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));
    for (const selector of ['.cal-task-meta', '.cal-history th', '.cal-state', '.cal-overdue']) {
      expect(rule(selector)).not.toContain('--text-xs');
    }
    expect(rule('.cal-task-meta')).toContain('font-size: var(--text-sm);');
    expect(rule('.cal-history th')).toContain('font-size: var(--text-sm);');
    expect(rule('.cal-state')).toContain('font-size: var(--text-sm);');
    expect(rule('  .cal-history td[data-label]::before')).toContain('font-size: var(--text-sm);');
  });
});

describe('C20 / C21 · localisation', () => {
  it('renders Ukrainian month, weekday and control copy', () => {
    const html = view({ view: 'month', year: 2026, month: 10, day: null }, { locale: 'uk', layout: 'A' });
    expect(html).toContain('жовтень 2026');
    expect(html).toContain('>пн<');
    expect(html).toContain('>історія</button>');
    expect(html).toContain('>сьогодні</button>');
    expect(html).toContain('aria-label="B · панелі тижнів"');
  });

  it('defines every cal_ key in both dictionaries', () => {
    const ru = Object.keys(LifeStrings.ru).filter(key => key.startsWith('cal_')).sort();
    const uk = Object.keys(LifeStrings.uk).filter(key => key.startsWith('cal_')).sort();
    expect(uk).toEqual(ru);
    expect(ru.some(key => key.startsWith('cal_seed_'))).toBe(false);
  });
});

describe('C35 · no fabricated Calendar data', () => {
  it('removed the seed pool, the weekly aggregator, the pill view and the cube/dialog surfaces', () => {
    for (const file of ['../data/calendar-seed.js', '../lib/calendar.js', '../components/CalendarView.jsx',
      '../pages/calendar/DayDetailModal.jsx', '../pages/calendar/CubeGrids.jsx', '../pages/calendar/DayManagerModal.jsx']) {
      expect(existsSync(new URL(file, import.meta.url))).toBe(false);
    }
  });

  it('builds the Calendar from state.tasks only — no dog feedings, seeds, prototype store or events', () => {
    for (const file of ['CalendarPage.jsx', 'TileGrids.jsx', 'DayDetails.jsx', 'calendarNav.js']) {
      const source = read(`../pages/calendar/${file}`);
      expect(source).not.toMatch(/calendar-seed|LifeCalendarSeed|feeding|meals|state\.dog|jenkin-store|JKStore|add_event|\baddEvent\b|onAddEvent/);
    }
  });

  it('an empty Calendar stays empty at every level', () => {
    const today = todayDateOnly();
    const html = withLocale(<CalendarPage />, 'ru', { tasks: [] });
    expect(html).toContain('data-layout="B"');
    expect(html).not.toMatch(/class="cal-dots/);
    expect(html).not.toContain('cal-line');
    expect(html).toContain(`data-date="${today}"`);
  });
});

describe('History view (C16, C17, C30, C36)', () => {
  const tasks = [
    { id: 1, title: 'выполненная', done: true, completed_at: '2026-10-12T09:00:00.000Z', created_at: '2026-10-01T09:00:00.000Z', schedule: { date: '2026-10-12', time: '' } },
    { id: 2, title: 'закрытая', done: false, closure: 'closed_unresolved', closed_at: '2026-10-13T09:00:00.000Z', created_at: '2026-10-02T09:00:00.000Z', schedule: { date: '2026-10-05', time: '' } },
    { id: 3, title: 'архивная', done: false, closure: 'archived', closed_at: '2026-10-11T09:00:00.000Z' },
    { id: 4, title: 'старая сделанная', done: true },
    { id: 5, title: 'просроченная активная', done: false, schedule: { date: '2026-10-01', time: '' } },
  ];

  const history = (locale = 'ru', list = tasks) => view({ view: 'history' }, { locale, tasks: list });

  it('lists the three accepted closure states, newest first, with Restore — inside the stage', () => {
    const html = history();
    expect(html).toContain('<div class="cal-stage" data-level="history">');
    const order = ['закрытая', 'выполненная', 'архивная', 'старая сделанная'].map(title => html.indexOf(`>${title}<`));
    expect(order.every(index => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('>Выполнена<');
    expect(html).toContain('>Закрыта, не выполнена<');
    expect(html).toContain('>В архиве<');
    expect(html).toContain('восстановить: закрытая');
    expect(html).not.toContain('просроченная активная');
  });

  it('shows creation, task and closing dates, and «—» for unknown legacy timestamps', () => {
    const html = history();
    expect(html).toContain('1 окт. 2026 г.');
    expect(html).toContain('13 окт. 2026 г.');
    const legacyRow = html.slice(html.indexOf('data-task-id="4"'));
    expect(legacyRow.match(/>—</g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders Ukrainian labels', () => {
    const html = history('uk');
    expect(html).toContain('>Виконана<');
    expect(html).toContain('>Закрита, не виконана<');
    expect(html).toContain('>В архіві<');
    expect(html).toContain('>відновити<');
  });

  it('has a truthful empty state', () => {
    expect(history('ru', [])).toContain('здесь появятся выполненные');
  });

  it('never reads activityLog', () => {
    const source = read('../pages/calendar/CalendarHistory.jsx');
    expect(source).not.toMatch(/\.activityLog|LifeActivity|lib\/activity/);
  });
});
