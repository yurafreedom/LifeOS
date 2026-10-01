/* JENKIN S1 · checkpoint 3: honest production state.
 *
 * A new production account starts EMPTY; demo content exists only in the
 * explicit fixture (context/lifeData/demoState.js) used by tests. Production
 * UI shows no fabricated balances, budgets, streaks, tokens, sync times or
 * integration status. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { buildDemoState } from '../context/lifeData/demoState.js';
import { buildInitialState } from '../context/lifeData/initialState.js';
import { migrateStateCopy } from '../context/lifeData/migrate.js';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { DogPage } from '../pages/DogPage.jsx';
import { FinancesPage } from '../pages/FinancesPage.jsx';
import { HomePage } from '../pages/HomePage.jsx';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const noop = () => {};
const LOCALE = { locale: 'ru', setLocale: noop, t: LifeMakeT('ru'), themeMode: 'dark', themeEff: 'dark', setTheme: noop, scenePref: 'auto', setScenePref: noop };

function productionSources() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'test') walk(full);
      } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(SRC);
  return files;
}

function render(node, state) {
  const data = new Proxy({ state, syncPhase: 'saved' }, { get: (target, key) => (key in target ? target[key] : noop) });
  const html = renderToStaticMarkup(
    <LifeLocaleContext.Provider value={LOCALE}>
      <LifeDataContext.Provider value={data}>{node}</LifeDataContext.Provider>
    </LifeLocaleContext.Provider>,
  );
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('a new production account is empty', () => {
  it('has no fabricated medications, doses, notes, transactions, goals, habits, tasks or pet', () => {
    const state = buildInitialState();
    expect(state.medications).toEqual([]);
    expect(state.doseLogs).toEqual({});
    expect(state.pharmNotes).toEqual({});
    expect(state.transactions).toEqual([]);
    expect(state.goals).toEqual([]);
    expect(state.habits).toEqual([]);
    expect(state.tasks).toEqual([]);
    expect(state.quickNotes).toEqual([]);
    expect(state.dog).toEqual({});
  });

  it('has a blank profile structure with no body measurements or sizes', () => {
    const { profile } = buildInitialState();
    const values = JSON.stringify(profile).match(/-?\d+(\.\d+)?/g);
    expect(values).toBeNull();
    expect(profile.body.history).toEqual([]);
  });

  it('survives its own migration unchanged (nothing is reseeded)', () => {
    const state = buildInitialState();
    expect(migrateStateCopy(state)).toEqual(state);
  });

  it('keeps the demo content only in the explicit fixture', () => {
    const demo = buildDemoState();
    expect(demo.medications.length).toBeGreaterThan(0);
    expect(demo.transactions.length).toBeGreaterThan(0);
    const offenders = productionSources().filter(file => {
      const text = fs.readFileSync(file, 'utf8');
      return /lifeData\/demoState|data\/dashboard-seed/.test(text) && !file.endsWith('demoState.js');
    }).map(file => path.relative(SRC, file));
    expect(offenders).toEqual([]);
    // The seeded Home dashboard (budget, streak, goal, six months of history) is gone.
    expect(fs.existsSync(path.join(SRC, 'data/dashboard-seed.js'))).toBe(false);
  });
});

describe('production UI states only what is true', () => {
  it('Home shows no invented budget, streak, goal, weekly tasks or trend for an empty account', () => {
    const text = render(<HomePage onNav={noop} />, buildInitialState());
    for (const invented of ['4 000', '2 480', '47', '84%', '23 / 30', '62%']) {
      expect(text).not.toContain(invented);
    }
    expect(text).toContain(LOCALE.t('home_card_budget_empty'));
    expect(text).toContain(LOCALE.t('home_card_streak_empty'));
    expect(text).toContain(LOCALE.t('home_card_goal_empty'));
  });

  it('Home derives its cards from the account’s own habits and goals', () => {
    const state = {
      ...buildInitialState(),
      habits: [{ id: 1, name: 'бег', week: [0, 0, 0, 0, 0, 0, 0], streak: 9 }],
      goals: [{ id: 'g', title: 'книга', pct: 40 }, { id: 'h', title: 'готово', pct: 100 }],
    };
    const text = render(<HomePage onNav={noop} />, state);
    expect(text).toContain('бег');
    expect(text).toContain('40%');
    expect(text).toContain('книга');
  });

  it('Finances shows no seeded $4,000 budget cap', () => {
    const text = render(<FinancesPage onAnalytics={null} />, buildInitialState());
    expect(text).not.toContain('4 000');
    expect(text).toContain(LOCALE.t('fin_budget_unset'));
  });

  it('the pet page is an honest empty state without a profile', () => {
    const text = render(<DogPage dog={{}} onUpdate={noop} locale="ru" t={LOCALE.t} />, buildInitialState());
    expect(text).toContain(LOCALE.t('dog_empty'));
    expect(text).not.toContain('мальтипу');
  });

  it('Settings holds no fake tokens, sync times or dead export buttons', () => {
    const settings = fs.readFileSync(path.join(SRC, 'components/SettingsPage.jsx'), 'utf8');
    const exportSection = fs.readFileSync(path.join(SRC, 'components/settings/ExportSection.jsx'), 'utf8');
    for (const fake of ['bot-token-masked', 'monobank-token-masked', '123456789', '2026-05-21 14:02', 'set_mono_pending', "c.id.length * 20"]) {
      expect(settings).not.toContain(fake);
    }
    expect(exportSection).not.toContain('.csv · 12 KB');
    expect(exportSection).not.toContain('.md · 24 KB');
  });
});
