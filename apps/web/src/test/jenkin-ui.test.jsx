import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar, accountEmailParts } from '../components/Sidebar.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { TasksPage } from '../pages/TasksPage.jsx';

/* JENKIN interface pass: Tasks filter dropdown, title/date type size,
   sidebar account block, visible branding. Technical identifiers stay. */

const source = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

function withLocale(locale, node) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark' }}>{node}</LifeLocaleContext.Provider>,
  );
}

/* The live Kyiv day is mocked so counts and «today» cues are deterministic. */
const kyiv = vi.hoisted(() => ({ today: '2026-10-14' }));
vi.mock('../app/useKyivToday.js', () => ({ useKyivToday: () => kyiv.today }));

const on = (date, time = '') => ({ schedule: { date, time } });
const TASKS = [
  { id: 1, title: 'купить корм', done: false, stakes: false, ...on('2026-10-16') },   // future
  { id: 2, title: 'сегодня утром', done: false, stakes: false, ...on('2026-10-14', '09:30') },
  { id: 3, title: 'сегодня важное', done: false, stakes: true, ...on('2026-10-14') },
  { id: 4, title: 'вчерашнее', done: false, stakes: false, ...on('2026-10-13') },     // overdue
  { id: 5, title: 'позавчера важное', done: false, stakes: true, ...on('2026-10-12', '18:00') }, // overdue
  { id: 6, title: 'без даты', done: false, stakes: false, schedule: null, tag: 'today', due: 'eod' }, // legacy label only
  { id: 7, title: 'время без даты', done: false, stakes: false, due: '17:00', schedule: { date: '', time: '17:00' } },
  { id: 8, title: 'сделано сегодня', done: true, stakes: true, completed_at: '2026-10-14T08:00:00.000Z', ...on('2026-10-14') },
  { id: 9, title: 'в архиве', done: false, stakes: true, closure: 'archived', closed_at: '2026-10-13T08:00:00.000Z', ...on('2026-10-14') },
  { id: 10, title: 'закрыта', done: false, stakes: false, closure: 'closed_unresolved', closed_at: '2026-10-13T08:00:00.000Z', ...on('2026-10-10') },
];
const WAITING = [
  { id: 'w1', title: 'ответ банка', waiting_for: null, created_at: '2026-10-01T09:00:00.000Z' },
  { id: 'w2', title: 'договор', waiting_for: 'юрист', created_at: '2026-10-02T09:00:00.000Z' },
  { id: 'w3', title: 'посылка', waiting_for: null, created_at: '2026-09-20T09:00:00.000Z', resolution: 'received', resolved_at: '2026-10-05T09:00:00.000Z' },
];

const tasksPage = (locale, tasks = TASKS, waitingItems = WAITING) => withLocale(locale, (
  <TasksPage tasks={tasks} waitingItems={waitingItems} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />
));
const optionsOf = html => [...html.matchAll(/<option value="([a-z]+)"[^>]*>([^<]+)<\/option>/g)].map(m => [m[1], m[2]]);

describe('Tasks · filter dropdown', () => {
  it.each([
    ['ru', 'показать', ['все', 'сегодня', 'просрочено', 'рутина', 'важное', 'ожидание', 'сделано']],
    ['uk', 'показати', ['усі', 'сьогодні', 'прострочено', 'рутина', 'важливе', 'очікування', 'зроблено']],
  ])('%s: one labelled <select> keeps every existing filter, each with its truthful count', (locale, label, labels) => {
    const html = tasksPage(locale);
    expect(html).not.toContain('tasks-chip');
    expect(html.split('<select').length - 1).toBe(1);
    /* The visible label wraps the select, so it is its accessible name. */
    expect(html).toMatch(new RegExp(`<label class="tasks-filter"><span class="tasks-filter-label mono">${label}</span>`));
    const ids = ['all', 'today', 'overdue', 'routine', 'stakes', 'waiting', 'done'];
    /* all 8 = every non-closed task (completed included, archived/closed not);
       today 2 and overdue 2 by schedule.date on the Kyiv day (undated, the
       legacy «today» tag and a dateless time never count); routine 5 and
       important 2 are active only; Waiting 2 = the active records;
       done 1. */
    const counts = [8, 2, 2, 5, 2, 2, 1];
    expect(optionsOf(html)).toEqual(ids.map((id, i) => [id, `${labels[i]} · ${counts[i]}`]));
    expect(html).toMatch(/<option value="all" selected="">/);
    /* The chevron is decorative. */
    expect(html).toContain('class="tasks-filter-chev" aria-hidden="true"');
  });

  it('derives every count from the same pipeline that renders the rows', () => {
    const code = source('../pages/TasksPage.jsx');
    expect(code).toContain("let xs = tasksForView(tasks, filter === 'waiting' ? 'all' : filter, today);");
    expect(code).toContain('...taskViewCounts(tasks, today),');
    expect(code).toContain('waiting: activeWaitingItems(waitingItems).length,');
    /* nothing hardcodes a count */
    expect(code).not.toMatch(/counts\s*=\s*\{\s*all:\s*\d/);
  });

  it('shows zero honestly for an empty list', () => {
    expect(optionsOf(tasksPage('ru', [], [])).map(o => o[1])).toEqual(
      ['все · 0', 'сегодня · 0', 'просрочено · 0', 'рутина · 0', 'важное · 0', 'ожидание · 0', 'сделано · 0']);
  });

  it('keeps sorting as its own separate control', () => {
    const html = tasksPage('ru');
    const filterEnd = html.indexOf('</label>');
    const sortAt = html.indexOf('class="tasks-sort"');
    expect(filterEnd).toBeGreaterThan(0);
    expect(sortAt).toBeGreaterThan(filterEnd);
    expect(html).toContain('сортировать: по дате');
    const select = html.slice(html.indexOf('<select'), html.indexOf('</select>'));
    expect(select).not.toContain('по дате');
    /* all three production sort modes stay, each exposing its state */
    const code = source('../pages/TasksPage.jsx');
    for (const mode of ["id: 'date'", "id: 'priority'", "id: 'category'"]) expect(code).toContain(mode);
    expect(code).toContain('aria-pressed={sort === s.id}');
    /* Escape closes the open sort list first and returns focus to its trigger —
       handled on the wrapper, so it also works while focus is still on the trigger */
    const wrapper = code.slice(code.indexOf('<div className="tasks-sort"'), code.indexOf('<button className="tasks-sort-trigger'));
    expect(wrapper).toContain("if (event.key !== 'Escape' || !sortOpen) return;");
    expect(wrapper).toContain('sortTriggerRef.current.focus()');
    /* a disclosure of toggle buttons, not a listbox */
    expect(code).not.toContain('aria-haspopup="listbox"');
    expect(code).toContain('aria-expanded={sortOpen}');
  });

  it('switches the view from the select value', () => {
    const code = source('../pages/TasksPage.jsx');
    expect(code).toContain('onChange={event => setFilter(event.target.value)}');
    expect(code).toContain("const waitingView = filter === 'waiting';");
  });
});

describe('Tasks · title and date share 13 px, hierarchy by weight and colour', () => {
  it('sets the Tasks title button and date to the same --text-md (13 px) token', () => {
    const life = source('../styles/pages-life.css');
    expect(source('../styles/tokens.css')).toMatch(/--text-md:\s+13px;/);
    expect(life).toMatch(/\.tasks-page \.task-title-btn \{\s*font-size: var\(--text-md\); font-weight: 500;[^}]*color: var\(--fg1\);/);
    expect(life).toMatch(/\.tasks-page \.task-due \{\s*font-size: var\(--text-md\); font-weight: 400;[^}]*color: var\(--fg3\);/);
    /* The title button resets `font`, which is why the size is set on it. */
    expect(source('../styles/modals.css')).toMatch(/\.task-title-btn \{[^}]*font: inherit;/);
    /* Home keeps its own list sizes: the change is scoped to the Tasks page. */
    expect(source('../styles/panels.css')).toMatch(/\.task-due \{\s*font-size: var\(--text-sm\);/);
  });

  it('says «просрочено» / «сегодня» in words, not only in colour (RU/UK)', () => {
    const ru = tasksPage('ru');
    expect(ru).toMatch(/<time class="task-due mono is-overdue" dateTime="2026-10-13">просрочено · 13 окт\.?<\/time>/);
    expect(ru).toMatch(/<time class="task-due mono is-overdue" dateTime="2026-10-12T18:00">просрочено · 12 окт\.? · 18:00<\/time>/);
    expect(ru).toContain('<time class="task-due mono is-today" dateTime="2026-10-14T09:30">сегодня · 09:30</time>');
    expect(ru).toContain('<time class="task-due mono is-today" dateTime="2026-10-14">сегодня</time>');
    expect(ru).toMatch(/<time class="task-due mono" dateTime="2026-10-16">16 окт\.?<\/time>/);
    const uk = tasksPage('uk');
    expect(uk).toMatch(/прострочено · 13 жовт\.?/);
    expect(uk).toContain('>сьогодні · 09:30</time>');
    /* a completed task dated today is not «today» work any more */
    expect(ru).toMatch(/>сделано сегодня<\/button><div class="task-meta"><time class="task-due mono" dateTime="2026-10-14">14 окт\.?<\/time>/);
    /* undated rows keep the legacy display label and never become today */
    const row = title => ru.slice(ru.indexOf(`>${title}</button>`), ru.indexOf('</div></div>', ru.indexOf(`>${title}</button>`)));
    expect(row('без даты')).not.toContain('<time');
    expect(row('время без даты')).not.toContain('<time');
    expect(row('время без даты')).toContain('<span class="task-due mono">17:00</span>');
  });

  it('labels each completion toggle with its task and state', () => {
    const html = tasksPage('ru');
    expect(html).toContain('aria-pressed="false" aria-label="выполнено: купить корм"');
    expect(html).toContain('aria-pressed="true" aria-label="выполнено: сделано сегодня"');
    expect(tasksPage('uk')).toContain('aria-label="виконано: купить корм"');
  });

  it('uses readable «today» ink on light surfaces and the danger colour for overdue', () => {
    const life = source('../styles/pages-life.css');
    expect(life).toContain('.tasks-page .task-due.is-overdue { color: var(--danger); }');
    expect(life).toContain('.tasks-page .task-due.is-today { color: var(--today-text); }');
    const tokens = source('../styles/tokens.css');
    expect(tokens.slice(0, tokens.indexOf('[data-theme="light"] {'))).toContain('--today-text: var(--o2);');
    expect(tokens.slice(tokens.indexOf('[data-theme="light"] {'))).toContain('--today-text: var(--o3);');
    expect(source('../styles/paradise.css')).toContain('--today-text: var(--o3);');
  });
});

describe('Sidebar · account block', () => {
  const t = LifeMakeT('ru');
  const sidebar = (email, syncPhase = 'saved') => withLocale('ru', (
    <Sidebar route="tasks" onNav={vi.fn()} collapsed={false} setCollapsed={vi.fn()}
             user={{ email }} syncPhase={syncPhase} />
  ));

  it('offers a wrap point before "@" and keeps the full address as the title', () => {
    const email = 'very.long.personal.address+lifeos@subdomain.example-provider.com';
    const html = sidebar(email);
    expect(html).toContain(`title="${email}"`);
    expect(html).toContain('very.long.personal.address+lifeos<wbr/>@subdomain.example-provider.com');
    expect(renderToStaticMarkup(<>{accountEmailParts('a@b.c')}</>)).toBe('a<wbr/>@b.c');
    expect(accountEmailParts('')).toBe('—');
    expect(accountEmailParts('no-at-sign')).toBe('no-at-sign');
  });

  it('shows the sync status on its own line after the email', () => {
    const html = sidebar('owner@example.com', 'offline');
    const name = html.indexOf('class="sb-foot-name"');
    const sub = html.indexOf('class="sb-foot-sub sb-sync is-offline mono"');
    expect(name).toBeGreaterThan(0);
    expect(sub).toBeGreaterThan(name);
    /* the email line closes before the sync line starts: separate lines */
    expect(html.indexOf('</div>', name)).toBeLessThan(sub);
    expect(html.slice(sub)).toContain(`<span class="sb-sync-text">${t('sync_offline')}</span>`);
  });

  it.each(['saved', 'saving', 'offline', 'error', 'conflict'])(
    'renders the provider sync phase «%s» verbatim in RU and UK — never a hardcoded "synced"', phase => {
      for (const locale of ['ru', 'uk']) {
        const html = withLocale(locale, (
          <Sidebar route="tasks" onNav={vi.fn()} collapsed={false} setCollapsed={vi.fn()}
                   user={{ email: 'owner@example.com' }} syncPhase={phase} />
        ));
        const text = LifeMakeT(locale)(`sync_${phase}`);
        expect(html).toContain(`class="sb-foot-sub sb-sync is-${phase} mono"`);
        expect(html).toContain('<span class="sb-sync-dot" aria-hidden="true"></span>');
        expect(html).toContain(`<span class="sb-sync-text">${text}</span>`);
        for (const other of ['saved', 'saving', 'offline', 'error', 'conflict'].filter(p => p !== phase)) {
          expect(html).not.toContain(`>${LifeMakeT(locale)(`sync_${other}`)}<`);
        }
      }
    });

  it('shows the profile name only when the user entered one — never an invented name', () => {
    const named = withLocale('ru', (
      <Sidebar route="tasks" onNav={vi.fn()} collapsed={false} setCollapsed={vi.fn()}
               user={{ email: 'owner@example.com' }} accountName="  Юра  " />
    ));
    expect(named).toContain('<div class="sb-account-name">Юра</div>');
    expect(named).toContain('<div class="sb-avatar" aria-hidden="true">Ю</div>');
    const unnamed = sidebar('owner@example.com');
    expect(unnamed).not.toContain('sb-account-name');
    expect(unnamed).toContain('<div class="sb-avatar" aria-hidden="true">o</div>');
    /* the name comes from the real profile, wired in the shell */
    expect(source('../App.jsx')).toContain("accountName={profile.identity && typeof profile.identity.name === 'string' ? profile.identity.name : ''}");
  });

  it('hides the account block when the sidebar is collapsed (unchanged)', () => {
    const html = withLocale('ru', (
      <Sidebar route="tasks" onNav={vi.fn()} collapsed setCollapsed={vi.fn()} user={{ email: 'owner@example.com' }} />
    ));
    expect(html).not.toContain('sb-foot-name');
  });

  it('never sizes the account text below 12 px and wraps instead of clipping', () => {
    const css = source('../styles/shell.css');
    const block = css.slice(css.indexOf('.sb-foot-meta'), css.indexOf('/* ====', css.indexOf('.sb-foot-meta')));
    expect(block).toContain('font: 500 var(--text-sm)/1.35');
    expect(block).toContain('overflow-wrap: anywhere');
    /* the sync line spans the whole block below the avatar + email */
    expect(block).toMatch(/\.sb-foot-sub \{\s*grid-column: 1 \/ -1;[^}]*font-size: var\(--text-sm\);[^}]*color: var\(--warm-beige\);/);
    expect(block).not.toMatch(/text-overflow|white-space: nowrap|line-clamp|font-size: (1[01]|[0-9])px|--text-xs/);
    expect(source('../styles/tokens.css')).toMatch(/--text-sm:\s+12px;/);
  });

  it('defines a warm beige for dark, light and paradise-day (night inherits dark)', () => {
    const tokens = source('../styles/tokens.css');
    const paradise = source('../styles/paradise.css');
    expect(tokens.slice(0, tokens.indexOf('[data-theme="light"] {'))).toContain('--warm-beige: #CDBBA4;');
    expect(tokens.slice(tokens.indexOf('[data-theme="light"] {'))).toContain('--warm-beige: #7A6650;');
    /* darker on paradise-day: the sidebar there is translucent cream over the scene */
    const day = paradise.slice(paradise.indexOf('[data-theme="paradise"][data-scene="day"] {'), paradise.indexOf('[data-theme="paradise"][data-scene="night"] {'));
    expect(day).toContain('--warm-beige: #66533E;');
    const night = paradise.slice(paradise.indexOf('[data-theme="paradise"][data-scene="night"] {'));
    expect(night.slice(0, night.indexOf('}'))).not.toContain('--warm-beige');
  });
});

/* WCAG 2.x relative luminance / contrast for opaque sRGB colours. */
function contrast(a, b) {
  const lum = hex => {
    const [r, g, b2] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('JENKIN · visible keyboard focus on the recorded gaps', () => {
  const tokens = source('../styles/tokens.css');
  const darkPrimary = tokens.slice(0, tokens.indexOf('[data-theme="light"] {')).match(/--primary:\s*(#[0-9A-Fa-f]{6});/)[1];
  const lightPrimary = tokens.slice(tokens.indexOf('[data-theme="light"] {')).match(/--primary:\s*(#[0-9A-Fa-f]{6});/)[1];
  const rule = (css, selector) => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));

  it('marks the task dialog title with a primary underline, without outline or layout shift', () => {
    const modals = source('../styles/modals.css');
    expect(rule(modals, '.qa-title')).toContain('outline: none;');
    const focus = rule(modals, '.qa-title:focus-visible');
    expect(focus).toContain('border-bottom-color: var(--primary);');
    expect(focus).toContain('box-shadow: 0 1px 0 var(--primary);');
    expect(focus).not.toMatch(/padding|margin|border-width|border-bottom:/);
  });

  it('gives the login inputs a real colour outline (the gradient --accent made it invalid)', () => {
    const auth = rule(source('../styles/paradise.css'), '.auth-form input:focus-visible');
    expect(auth).toContain('outline: 2px solid var(--primary);');
    for (const file of ['../styles/paradise.css', '../styles/shell.css', '../styles/modals.css', '../brand.css']) {
      expect(source(file).replace(/\/\*[\s\S]*?\*\//g, ''), file).not.toMatch(/outline[^;]*var\(--accent\)/);
    }
  });

  it('outlines the TopBar search field in the solid primary colour in every theme', () => {
    const shell = rule(source('../styles/shell.css'), '.tb-cmd:focus-within');
    expect(shell).toContain('border-color: var(--primary);');
    expect(shell).toContain('box-shadow: var(--primary-focus-shadow);');
    /* no theme re-points it to the translucent ring */
    expect(source('../styles/theme-light.css')).not.toContain('.tb-cmd:focus-within');
    expect(source('../styles/paradise.css')).not.toContain('.tb-cmd:focus-within');
  });

  it('keeps each indicator at least 3:1 against the light and dark dialog surfaces', () => {
    expect(contrast(lightPrimary, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrast(darkPrimary, '#14181F')).toBeGreaterThanOrEqual(3);
  });
});

describe('JENKIN · contrast floors on opaque light surfaces', () => {
  const tokens = source('../styles/tokens.css');
  const light = tokens.slice(tokens.indexOf('[data-theme="light"] {'));
  const value = name => light.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`))[1];

  it('keeps the unchecked task box edge at least 3:1 on the white card', () => {
    expect(contrast(value('--check-border'), '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });

  it('keeps the sync line and the «today» cues at least 4.5:1 on white', () => {
    expect(contrast(value('--warm-beige'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(light).toContain('--today-text: var(--o3);');
    expect(light).toContain('--today-num: var(--o3);');
    expect(contrast(value('--o3'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('draws the overdue badge with the stronger red of each theme', () => {
    const calendar = source('../styles/finance-calendar.css');
    const rule = calendar.slice(calendar.indexOf('.cal-overdue {'), calendar.indexOf('}', calendar.indexOf('.cal-overdue {')));
    expect(rule).toContain('color: var(--red-2);');
    expect(contrast(value('--red-2'), '#FCE4E5')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('JENKIN · material tokens', () => {
  const MATERIAL = ['--mat-sheen', '--mat-gloss', '--mat-shadow', '--mat-shadow-hover', '--mat-shadow-gloss',
    '--mat-shadow-today', '--mat-control-edge', '--mat-field'];

  it('extends the existing theme token sets instead of adding a parallel design system', () => {
    const tokens = source('../styles/tokens.css');
    const dark = tokens.slice(0, tokens.indexOf('[data-theme="light"] {'));
    const light = tokens.slice(tokens.indexOf('[data-theme="light"] {'));
    const paradise = source('../styles/paradise.css');
    const day = paradise.slice(paradise.indexOf('[data-theme="paradise"][data-scene="day"] {'), paradise.indexOf('[data-theme="paradise"][data-scene="night"] {'));
    for (const name of MATERIAL) {
      expect(dark).toContain(`${name}:`);
      expect(light).toContain(`${name}:`);
      expect(day).toContain(`${name}:`);
    }
    expect(dark).toContain('--mat-focus: 0 0 0 1px var(--primary-focus-ring), var(--primary-focus-shadow);');
    /* the cascade manifest is unchanged: no new stylesheet layer */
    expect(source('../styles.css').match(/@import/g)).toHaveLength(14);
  });
});

describe('JENKIN · paradise-day task checkbox contrast', () => {
  it('uses the theme token instead of the invisible dark-theme literal', () => {
    const panels = source('../styles/panels.css');
    const rule = panels.slice(panels.indexOf('.task-check {'), panels.indexOf('}', panels.indexOf('.task-check {')));
    expect(rule).toContain('border: 1.5px solid var(--check-border);');
    expect(rule).not.toContain('rgba(255,255,255,0.22)');
    const paradise = source('../styles/paradise.css');
    const day = paradise.slice(paradise.indexOf('[data-theme="paradise"][data-scene="day"] {'), paradise.indexOf('[data-theme="paradise"][data-scene="night"] {'));
    expect(day).toContain('--check-border: rgba(26,31,41,0.5);');
    expect(paradise).toContain('[data-theme="paradise"][data-scene="day"] .task-check:hover { border-color: var(--primary); }');
    /* dark (and paradise-night, which inherits it) raise the white edge too */
    const tokens = source('../styles/tokens.css');
    expect(tokens.slice(0, tokens.indexOf('[data-theme="light"] {'))).toContain('--check-border: rgba(255,255,255,0.36);');
  });
});

describe('JENKIN · visible branding', () => {
  it('names the product JENKIN in the sidebar, login and page metadata', () => {
    const html = withLocale('uk', (
      <Sidebar route="home" onNav={vi.fn()} collapsed={false} setCollapsed={vi.fn()} user={null} />
    ));
    expect(html).toContain('aria-label="JENKIN"');
    expect(html).toContain('<svg class="jenkin-wordmark"');
    expect(html).not.toMatch(/Life|·OS/);
    expect(source('../pages/LoginPage.jsx')).toContain('<div className="auth-brand" role="img" aria-label="JENKIN"><JenkinWordmark /></div>');
    const index = source('../../index.html');
    expect(index).toContain('<title>JENKIN</title>');
    expect(index).toContain('<meta name="application-name" content="JENKIN" />');
    expect(index).not.toContain('Life OS');
  });

  it('uses JENKIN in RU/UK copy that names the product', () => {
    for (const locale of ['ru', 'uk']) {
      const dict = source(`../context/locale/${locale}.js`).split('\n').slice(3).join('\n');
      /* also the dotted wordmark («Life·OS») the first pass missed */
      expect(dict).not.toMatch(/Life\s*[·.]?\s*OS/i);
      const t = LifeMakeT(locale);
      expect(t('aa_sr_selfcheck_title')).toMatch(/JENKIN$/);
      expect(t('auth_login_title')).toMatch(/JENKIN$/);
      expect(t('boot_loading')).toMatch(/^JENKIN — /);
      expect(t('goal_ship_v1')).toContain('JENKIN');
    }
  });

  it('keeps storage keys and export file names unchanged', () => {
    expect(source('../../index.html')).toContain("localStorage.getItem('lifeOsTheme')");
    expect(source('../app/useSidebarCollapsed.js')).toContain("'lifeOsSidebar'");
    expect(source('../repositories/legacyLocalImport.ts')).toContain("'lifeOsState'");
    expect(source('../sound/preferences.ts')).toContain("'lifeOsSfx'");
    expect(source('../repositories/analyticsWriteQueue.ts')).toContain("'lifeos-adaptive-analytics'");
    expect(source('../components/settings/ExportSection.jsx')).toContain("'lifeos-account.zip'");
    expect(source('../components/settings/DangerSection.jsx')).toContain("'lifeOsState.json'");
  });
});
