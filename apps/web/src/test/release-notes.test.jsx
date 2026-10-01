import React from 'react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import packageJson from '../../package.json';
import { APP_BUILD_VERSION, RELEASE_NOTES, formatReleaseDate, releaseStatus } from '../app/releaseInfo.js';
import { normalizeRoute, readRouteFromHash } from '../app/routeRegistry.js';
import { SettingsPage } from '../components/SettingsPage.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { LifeLocaleContext, LifeLocales, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import releaseNotesData from '../data/releaseNotes.json';
import { RELEASE_CHANGE_KINDS, RELEASE_STATUSES, changeGroups, validateReleaseNotes } from '../domain/releaseNotes.js';
import { renderChangelog } from '../domain/releaseNotesChangelog.js';
import { UpdatesPage, initialOpenIds, toggleOpenId } from '../pages/updates/UpdatesPage.jsx';

/* JENKIN update history: one repository source (data/releaseNotes.json),
   validated, rendered by #/updates and generated into the root CHANGELOG.md. */

const text = (ru, uk = ru + ' (uk)') => ({ ru, uk });
function entry(overrides = {}) {
  return {
    id: 'unreleased',
    status: 'unreleased',
    version: null,
    releasedOn: null,
    title: text('Заголовок'),
    summary: text('Кратко'),
    changes: { features: [text('Новое')] },
    ...overrides,
  };
}
const released = (version, releasedOn, extra = {}) => entry({ id: 'v' + version.replace(/\./g, '-'), status: 'released', version, releasedOn, ...extra });
const notes = (...entries) => ({ schemaVersion: 1, entries });
const errorsOf = data => {
  const result = validateReleaseNotes(data);
  return result.ok ? [] : result.errors;
};

function withLocale(locale, node, themeEff = 'dark') {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff, setLocale: () => {} }}>{node}</LifeLocaleContext.Provider>,
  );
}

afterEach(() => { delete globalThis.window; });

describe('canonical release notes', () => {
  it('validate against the schema', () => {
    expect(validateReleaseNotes(releaseNotesData)).toEqual({ ok: true, entries: releaseNotesData.entries });
    expect(RELEASE_NOTES.ok).toBe(true);
  });

  it('are complete in RU and UK — every text is translated, none copied across', () => {
    for (const item of releaseNotesData.entries) {
      const texts = [item.title, item.summary, ...Object.values(item.changes).flat(), ...(item.technical || [])];
      for (const value of texts) {
        expect(Object.keys(value).sort()).toEqual(['ru', 'uk']);
        expect(value.ru.trim().length).toBeGreaterThan(0);
        expect(value.uk.trim().length).toBeGreaterThan(0);
        expect(value.uk).not.toBe(value.ru);
      }
    }
  });

  it('show the current work as one unreleased entry: no invented version, no date', () => {
    const [first, ...rest] = releaseNotesData.entries;
    expect(first).toMatchObject({ id: 'unreleased', status: 'unreleased', version: null, releasedOn: null });
    /* No formal release exists yet; the build version is only package.json. */
    expect(rest.filter(e => e.status === 'released')).toEqual([]);
    expect(APP_BUILD_VERSION).toBe(packageJson.version);
    expect(releaseStatus()).toEqual({ hasUnreleased: true, latestReleased: null });
  });

  it('reference only commits that exist in this checkout', () => {
    let git = true;
    try { execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' }); } catch { git = false; }
    if (!git) return; /* exported sources without Git: the format check above still applies */
    for (const ref of releaseNotesData.entries.flatMap(e => e.refs || [])) {
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', ref.value, 'HEAD'], { stdio: 'ignore' }), ref.value).not.toThrow();
    }
  });

  it('keep CHANGELOG.md generated from the same source (npm run release-notes)', () => {
    const changelog = readFileSync(new URL('../../../../CHANGELOG.md', import.meta.url), 'utf8');
    expect(changelog).toBe(renderChangelog(releaseNotesData, { ru: LifeStrings.ru, uk: LifeStrings.uk }));
  });
});

describe('validateReleaseNotes', () => {
  it('accepts an unreleased entry followed by released ones, newest first', () => {
    expect(errorsOf(notes(entry(), released('0.3.0', '2026-12-01'), released('0.2.0', '2026-11-01')))).toEqual([]);
  });

  it.each([
    ['a missing UK text', notes(entry({ title: { ru: 'Заголовок' } })), /title\.uk: missing text/],
    ['an empty change list', notes(entry({ changes: { fixes: [] } })), /changes\.fixes: expected a non-empty list/],
    ['an unknown change group', notes(entry({ changes: { misc: [text('x')] } })), /unknown group "misc"/],
    ['an unknown locale', notes(entry({ summary: { ru: 'a', uk: 'b', en: 'c' } })), /unknown locale "en"/],
    ['an unreleased version', notes(entry({ version: '0.1.0' })), /unreleased entry has no version/],
    ['an unreleased date', notes(entry({ releasedOn: '2026-10-01' })), /unreleased entry has no release date/],
    ['a released entry without a date', notes(released('1.0.0', null)), /needs its real release date/],
    ['an impossible date', notes(released('1.0.0', '2026-02-30')), /needs its real release date/],
    ['a non-semver version', notes(released('v1', '2026-10-01')), /MAJOR\.MINOR\.PATCH/],
    ['an unknown status', notes(entry({ status: 'beta' })), /status: expected one of/],
    ['two unreleased entries', notes(entry(), entry({ id: 'second' })), /at most one unreleased entry/],
    ['unreleased below a release', notes(released('1.0.0', '2026-10-01'), entry()), /unreleased entry must be first/],
    ['releases out of date order', notes(released('0.2.0', '2026-10-01'), released('0.3.0', '2026-11-01')), /newest first/],
    ['a version that does not grow', notes(released('0.2.0', '2026-11-01'), released('0.2.0', '2026-10-01', { id: 'again' })), /must be greater than/],
    ['a duplicate id', notes(released('0.3.0', '2026-11-01', { id: 'same' }), released('0.2.0', '2026-10-01', { id: 'same' })), /duplicate "same"/],
    ['an email address', notes(entry({ summary: text('пишите на owner@example.com') })), /contains an email address/],
    ['a local path', notes(entry({ summary: text('лежит в /Users/someone/file') })), /contains a local filesystem path/],
    ['a local address', notes(entry({ summary: text('откройте 127.0.0.1') })), /contains a local address/],
    ['a malformed commit ref', notes(entry({ refs: [{ kind: 'commit', value: 'HEAD' }] })), /refs\[0\]/],
    ['an unknown field', notes(entry({ draft: true })), /unknown field "draft"/],
    ['a wrong schema version', { schemaVersion: 2, entries: [] }, /schemaVersion: expected 1/],
  ])('rejects %s', (_, data, message) => {
    expect(errorsOf(data).join('\n')).toMatch(message);
  });

  it('lists change groups in display order and skips absent ones', () => {
    const e = entry({ changes: { limitations: [text('a')], features: [text('b')], security: [text('c')] } });
    expect(changeGroups(e).map(g => g.kind)).toEqual(['features', 'security', 'limitations']);
  });
});

describe('labels', () => {
  it('exist in RU and UK for every status, change group and page string', () => {
    const keys = [
      'upd_title', 'upd_intro', 'upd_build', 'upd_list_label', 'upd_dev_build', 'upd_version', 'upd_no_date',
      'upd_technical', 'upd_refs', 'upd_empty', 'upd_error', 'upd_back',
      'set_about', 'set_about_build', 'set_about_release', 'set_about_released', 'set_about_none_released',
      'set_about_unreleased', 'set_about_open_updates',
      ...RELEASE_STATUSES.map(s => 'upd_status_' + s),
      ...RELEASE_CHANGE_KINDS.map(k => 'upd_kind_' + k),
    ];
    for (const locale of LifeLocales) {
      for (const key of keys) expect(typeof LifeStrings[locale][key], `${locale}.${key}`).toBe('string');
    }
  });

  it('format a release date as a calendar day in either locale, independent of the viewer timezone', () => {
    expect(formatReleaseDate('2026-12-01', 'ru-RU')).toBe('1 декабря 2026 г.');
    expect(formatReleaseDate('2026-12-01', 'uk-UA')).toBe('1 грудня 2026 р.');
  });
});

describe('Updates page', () => {
  const HISTORY = validateReleaseNotes(notes(
    entry({ title: text('Готовится'), technical: [text('деталь')], refs: [{ kind: 'commit', value: 'abc1234' }] }),
    released('0.2.0', '2026-11-20', { title: text('Второй выпуск') }),
    released('0.1.0', '2026-10-05', { title: text('Первый выпуск') }),
  ));

  it.each(LifeLocales)('renders the canonical notes in %s with title, build version and status', (locale) => {
    const t = LifeMakeT(locale);
    const html = withLocale(locale, <UpdatesPage />);
    expect(html).toContain(`<h2 class="page-title">${t('upd_title')}</h2>`);
    expect(html).toContain(t('upd_build', packageJson.version));
    expect(html).toContain(releaseNotesData.entries[0].title[locale]);
    expect(html).toContain(`>${t('upd_status_unreleased')}<`);
    expect(html).toContain(`>${t('upd_no_date')}<`);
    expect(html).toContain('href="#/settings/about"');
  });

  it('lists entries newest first; only the newest is expanded, older ones show version, status and date', () => {
    const html = withLocale('ru', <UpdatesPage notes={HISTORY} />);
    const titles = [...html.matchAll(/class="upd-entry-title">([^<]+)</g)].map(m => m[1]);
    expect(titles).toEqual(['Готовится', 'Второй выпуск', 'Первый выпуск']);
    const expanded = [...html.matchAll(/aria-expanded="(true|false)"/g)].map(m => m[1]);
    expect(expanded).toEqual(['true', 'false', 'false']);
    expect(html).toContain('id="upd-unreleased-body" class="upd-entry-body" role="region" aria-labelledby="upd-unreleased-toggle">');
    expect(html).toMatch(/id="upd-v0-2-0-body" class="upd-entry-body" role="region" aria-labelledby="upd-v0-2-0-toggle" hidden=""/);
    /* collapsed headers still carry version, status and date */
    expect(html).toContain('версия 0.2.0');
    expect(html).toContain('<time class="upd-date" dateTime="2026-11-20">20 ноября 2026 г.</time>');
    expect(html.match(/>выпущено</g)).toHaveLength(2);
  });

  it('labels released and unreleased entries correctly', () => {
    const html = withLocale('uk', <UpdatesPage notes={HISTORY} />);
    expect(html).toMatch(/upd-version mono">збірка розробки<\/span><span class="upd-status is-unreleased">не випущено</);
    expect(html).toMatch(/upd-version mono">версія 0\.1\.0<\/span><span class="upd-status is-released">випущено</);
    /* an unreleased entry never shows a date, only that none is assigned */
    expect(html).toMatch(/upd-status is-unreleased">не випущено<\/span><span class="upd-date">дату випуску не призначено</);
    expect(html.match(/<time /g)).toHaveLength(2);
  });

  it('wires each header as an accessible disclosure button and hides technical details behind <details>', () => {
    const html = withLocale('ru', <UpdatesPage notes={HISTORY} />);
    expect(html).toContain('<h3 class="upd-entry-h"><button type="button" id="upd-unreleased-toggle" class="upd-toggle" aria-expanded="true" aria-controls="upd-unreleased-body">');
    expect(html).toMatch(/<details class="upd-tech"><summary>технические подробности<\/summary>/);
    expect(html).toContain('<code>abc1234</code>');
    expect(html).toMatch(/<ol class="upd-list" aria-label="Записи об обновлениях">/);
  });

  it('toggles one entry at a time without closing the others', () => {
    const open = initialOpenIds(HISTORY.entries);
    expect([...open]).toEqual(['unreleased']);
    const both = toggleOpenId(open, 'v0-2-0');
    expect([...both].sort()).toEqual(['unreleased', 'v0-2-0']);
    expect([...open]).toEqual(['unreleased']); /* no mutation */
    expect([...toggleOpenId(both, 'unreleased')]).toEqual(['v0-2-0']);
    expect([...initialOpenIds([])]).toEqual([]);
  });

  it('shows an empty state and an error state instead of a broken list', () => {
    expect(withLocale('ru', <UpdatesPage notes={{ ok: true, entries: [] }} />)).toContain('<p class="upd-state">Записей об обновлениях пока нет.</p>');
    const broken = withLocale('uk', <UpdatesPage notes={validateReleaseNotes({ schemaVersion: 1, entries: [{}] })} />);
    expect(broken).toContain('role="alert"');
    expect(broken).not.toContain('upd-list');
  });

  it('uses the paradise hero header like the other pages', () => {
    expect(withLocale('ru', <UpdatesPage />, 'paradise')).toContain('hero-scene');
  });
});

describe('navigation', () => {
  it('routes #/updates and the Settings → About deep link', () => {
    expect(readRouteFromHash('#/updates')).toBe('updates');
    expect(readRouteFromHash('#/settings/about')).toBe('settings');
    expect(normalizeRoute('settings/about')).toEqual({ route: 'settings', hash: '#/settings/about' });
  });

  it('Settings lists About and #/settings/about opens it with a link to the update history', () => {
    globalThis.window = { location: { hash: '#/settings/about' } };
    const html = withLocale('ru', <SettingsPage />);
    expect(html).toMatch(/class="set-nav-btn is-on">о JENKIN</);
    expect(html).toContain(`<span class="set-about-value mono">${packageJson.version}</span>`);
    expect(html).toContain('выпусков пока нет');
    expect(html).toContain('<a class="set-btn-ghost set-about-link" href="#/updates">открыть историю обновлений</a>');
  });

  it('Settings still opens on the account section by default', () => {
    globalThis.window = { location: { hash: '#/settings' } };
    const html = withLocale('uk', (
      <AuthContext.Provider value={{ phase: 'authenticated', user: { id: 'u1', email: '' }, logout: () => {} }}><SettingsPage /></AuthContext.Provider>
    ));
    expect(html).toMatch(/class="set-nav-btn is-on">акаунт</);
    expect(html).not.toContain('set-about-link');
  });
});
