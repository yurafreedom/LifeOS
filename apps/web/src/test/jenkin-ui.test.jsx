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

const tasksPage = locale => withLocale(locale, (
  <TasksPage tasks={[{ id: 1, title: 'купить корм', done: false, stakes: false, schedule: { date: '2026-10-02', time: '' } }]}
             waitingItems={[]} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />
));

describe('Tasks · filter dropdown', () => {
  it.each([
    ['ru', 'показать', ['все', 'сегодня', 'просрочено', 'рутина', 'важное', 'ожидание', 'сделано']],
    ['uk', 'показати', ['усі', 'сьогодні', 'прострочено', 'рутина', 'важливе', 'очікування', 'зроблено']],
  ])('%s: one labelled <select> keeps every existing filter, Waiting and Completed included', (locale, label, labels) => {
    const html = tasksPage(locale);
    expect(html).not.toContain('tasks-chip');
    expect(html.split('<select').length - 1).toBe(1);
    /* The visible label wraps the select, so it is its accessible name. */
    expect(html).toMatch(new RegExp(`<label class="tasks-filter"><span class="tasks-filter-label mono">${label}</span>`));
    const ids = ['all', 'today', 'overdue', 'routine', 'stakes', 'waiting', 'done'];
    const options = [...html.matchAll(/<option value="([a-z]+)"[^>]*>([^<]+)<\/option>/g)].map(m => [m[1], m[2]]);
    expect(options).toEqual(ids.map((id, i) => [id, labels[i]]));
    expect(html).toContain('<option value="all" selected="">');
    /* The chevron is decorative. */
    expect(html).toContain('class="tasks-filter-chev" aria-hidden="true"');
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
  });

  it('switches the view from the select value', () => {
    const code = source('../pages/TasksPage.jsx');
    expect(code).toContain('onChange={event => setFilter(event.target.value)}');
    expect(code).toContain("const waitingView = filter === 'waiting';");
  });
});

describe('Tasks · title size matches its date metadata', () => {
  it('sets the Tasks title button and .task-due to the same --text-sm token', () => {
    const life = source('../styles/pages-life.css');
    const panels = source('../styles/panels.css');
    expect(life).toMatch(/\.tasks-page \.task-title-btn \{ font-size: var\(--text-sm\);/);
    expect(panels).toMatch(/\.task-due \{\s*font-size: var\(--text-sm\);/);
    /* The title button resets `font`, which is why the size is set on it. */
    expect(source('../styles/modals.css')).toMatch(/\.task-title-btn \{[^}]*font: inherit;/);
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
    const sub = html.indexOf('class="sb-foot-sub mono"');
    expect(sub).toBeGreaterThan(name);
    expect(html.slice(sub)).toContain(`>${t('sync_offline')}</div>`);
  });

  it('never sizes the account text below 12 px and wraps instead of clipping', () => {
    const css = source('../styles/shell.css');
    const block = css.slice(css.indexOf('.sb-foot-meta'), css.indexOf('/* ====', css.indexOf('.sb-foot-meta')));
    expect(block).toContain('font: 500 var(--text-sm)/1.35');
    expect(block).toContain('overflow-wrap: anywhere');
    expect(block).toMatch(/\.sb-foot-sub \{ display: block; font-size: var\(--text-sm\);/);
    expect(block).not.toMatch(/text-overflow|white-space: nowrap|font-size: (1[01]|[0-9])px|--text-xs/);
    expect(source('../styles/tokens.css')).toMatch(/--text-sm:\s+12px;/);
  });
});

describe('JENKIN · visible branding', () => {
  it('names the product JENKIN in the sidebar, login and page metadata', () => {
    const html = withLocale('uk', (
      <Sidebar route="home" onNav={vi.fn()} collapsed={false} setCollapsed={vi.fn()} user={null} />
    ));
    expect(html).toContain('aria-label="JENKIN"');
    expect(html).toContain('>JENKIN</tspan>');
    expect(html).not.toMatch(/Life|·OS/);
    expect(source('../pages/LoginPage.jsx')).toContain('<div className="auth-brand">JENKIN</div>');
    const index = source('../../index.html');
    expect(index).toContain('<title>JENKIN</title>');
    expect(index).toContain('<meta name="application-name" content="JENKIN" />');
    expect(index).not.toContain('Life OS');
  });

  it('uses JENKIN in RU/UK copy that names the product', () => {
    for (const locale of ['ru', 'uk']) {
      const dict = source(`../context/locale/${locale}.js`).split('\n').slice(3).join('\n');
      expect(dict).not.toMatch(/Life ?OS/);
      expect(LifeMakeT(locale)('aa_sr_selfcheck_title')).toMatch(/JENKIN$/);
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
