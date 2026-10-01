import React from 'react';
import { APP_BUILD_VERSION, formatReleaseDate, releaseStatus } from '../app/releaseInfo.js';
import { useInterfaceFont } from '../app/useInterfaceFont.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeLocales } from '../context/LocaleContext.jsx';
import { LifeCatTintClass, LifeCategories } from '../data/categories.js';
import { EyeToggle } from './EyeToggle.jsx';
import { SyncStatus } from './SyncStatus.jsx';
import { LIcons } from './icons.jsx';
import { DangerSection } from './settings/DangerSection.jsx';
import { ExportSection } from './settings/ExportSection.jsx';
import { RetentionSection } from './settings/RetentionSection.jsx';
import { SecuritySection } from './settings/SecuritySection.jsx';
import { SoundSection } from './settings/SoundSection.jsx';
import { Row } from './settings/Row.jsx';

/* global React */
const { useState: useStateSet, useContext: useCtxSet } = React;

function SettingsPage() {
  const { t, locale, setLocale } = useCtxSet(LifeLocaleContext);
  const I = LIcons;

  const sections = [
    { id: 'account',       label: t('set_account') },
    { id: 'security',      label: t('set_security') },
    { id: 'categories',    label: t('set_categories') },
    { id: 'telegram',      label: t('set_telegram') },
    { id: 'monobank',      label: t('set_monobank') },
    { id: 'notifications', label: t('set_notifications') },
    { id: 'appearance',    label: t('set_appearance') },
    { id: 'sound',         label: t('set_sound') },
    { id: 'export',        label: t('set_export') },
    { id: 'retention',     label: t('set_retention') },
    { id: 'about',         label: t('set_about') },
    { id: 'danger',        label: t('set_danger') },
  ];
  /* #/settings/about opens About directly (the Updates page links back to
     it); the hash follows the About selection without a hashchange. */
  const [sel, setSelRaw] = useStateSet(() => (
    typeof window !== 'undefined' && window.location.hash === '#/settings/about' ? 'about' : 'account'
  ));
  function setSel(id) {
    setSelRaw(id);
    if (typeof window === 'undefined') return;
    const target = id === 'about' ? '#/settings/about' : '#/settings';
    if (window.location.hash !== target && /^#\/settings(\/about)?$/.test(window.location.hash)) {
      window.history.replaceState(window.history.state, '', target);
    }
  }

  return (
    <div className="set-wrap">
      <h2 className="set-h">{t('set_title')}</h2>
      <div className="set-layout">
        <nav className="set-nav">
          {sections.map(s => (
            <button key={s.id}
                    className={"set-nav-btn" + (sel === s.id ? " is-on" : "") + (s.id === 'danger' ? " is-danger" : "")}
                    onClick={() => setSel(s.id)}>{s.label}</button>
          ))}
        </nav>
        <div className="set-body">
          {sel === 'account'       && <AccountSection t={t}/>}
          {sel === 'security'      && <SecuritySection t={t}/>}
          {sel === 'categories'    && <CategoriesSection t={t} locale={locale}/>}
          {sel === 'telegram'      && <TelegramSection t={t}/>}
          {sel === 'monobank'      && <MonobankSection t={t}/>}
          {sel === 'notifications' && <NotificationsSection t={t}/>}
          {sel === 'appearance'    && <AppearanceSection t={t} locale={locale} setLocale={setLocale}/>}
          {sel === 'sound'         && <SoundSection t={t}/>}
          {sel === 'export'        && <ExportSection t={t}/>}
          {sel === 'retention'     && <RetentionSection t={t}/>}
          {sel === 'about'         && <AboutSection t={t}/>}
          {sel === 'danger'        && <DangerSection t={t}/>}
        </div>
      </div>
    </div>
  );
}

function AccountSection({ t }) {
  const auth = useAuth();
  const [error, setError] = useStateSet('');
  /* Never claims a logout the server did not confirm; unsaved edits are
     resolved first by the data provider's guard (LogoutPendingDialog). */
  async function logout() {
    setError('');
    try { await auth.logout(); }
    catch { setError(t('auth_logout_error')); }
  }
  return (
    <React.Fragment>
      <Row label={t('set_account_email')} hint="read-only"><input className="set-input is-readonly" readOnly value={auth.user?.email || ''}/></Row>
      <Row label={t('sync_status')}><SyncStatus /></Row>
      <Row label="" hint={error}><button className="set-btn-ghost" onClick={logout}>{t('auth_logout')}</button></Row>
    </React.Fragment>
  );
}

/* About JENKIN: the build version (apps/web/package.json) is not a release;
   the release line comes from the validated release notes. */
function AboutSection({ t }) {
  const { hasUnreleased, latestReleased } = releaseStatus();
  return (
    <React.Fragment>
      <Row label={t('set_about_build')}><span className="set-about-value mono">{APP_BUILD_VERSION}</span></Row>
      <Row label={t('set_about_release')}>
        <span className="set-about-value">
          {latestReleased
            ? t('set_about_released', latestReleased.version, formatReleaseDate(latestReleased.releasedOn, t('_intl_locale')))
            : t('set_about_none_released')}
          {hasUnreleased ? <span className="set-about-sub">{t('set_about_unreleased')}</span> : null}
        </span>
      </Row>
      <Row label={t('upd_title')}>
        <a className="set-btn-ghost set-about-link" href="#/updates">{t('set_about_open_updates')}</a>
      </Row>
    </React.Fragment>
  );
}

function CategoriesSection({ t, locale }) {
  const cats = LifeCategories;
  const data = React.useContext(LifeDataContext);
  const overrides = (data && data.state && data.state.categoryOverrides) || {};
  return (
    <React.Fragment>
      <div className="set-table set-table-cat">
        <div className="set-table-head mono">
          <span>{t('set_cat_name')}</span><span>{t('set_cat_budget')}</span><span>{t('set_cat_in_totals')}</span>
        </div>
        {cats.map(c => {
          const o = overrides[c.id];
          const included = !o || o.included_in_totals !== false;
          const tip = included ? t('eye_cat_exclude') : t('eye_cat_include');
          return (
            <div key={c.id} className={"set-table-row" + (included ? '' : ' is-excluded')}>
              <div className="set-table-cell">
                <span className={"qa-cat-dot " + LifeCatTintClass[c.tint]}>
                  {LIcons[c.icon] && LIcons[c.icon]({ size: 12 })}
                </span>
                <span>{c.name[locale]}</span>
              </div>
              {/* No category budgets exist yet: never an invented amount. */}
              <div className="set-table-cell mono" title={t('set_cat_budget_unset')}>—</div>
              <div className="set-table-cell set-table-cell-eye">
                <EyeToggle
                  included={included}
                  onToggle={() => data && data.toggleCategoryInclusion(c.id)}
                  title={tip}
                  ariaLabel={tip}
                  size={14}
                />
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

/* JENKIN S1 · honest integration states. These sections used to show masked
   fake tokens, a fake last-sync time, "7 pending" transactions and switches
   that did nothing. Nothing is connected and no token is stored, so they say
   exactly that. Bank access is the F4/F5 roadmap slice. */
function UnavailableIntegration({ t, title, body }) {
  return (
    <div className="set-unavailable" role="status">
      <div className="set-unavailable-state mono">{t('set_not_connected')}</div>
      <p className="set-unavailable-title">{title}</p>
      <p className="set-unavailable-body">{body}</p>
    </div>
  );
}

function TelegramSection({ t }) {
  return <UnavailableIntegration t={t} title={t('set_telegram')} body={t('set_tg_unavailable')} />;
}

function MonobankSection({ t }) {
  return <UnavailableIntegration t={t} title={t('set_monobank')} body={t('set_mono_unavailable')} />;
}

function NotificationsSection({ t }) {
  return <UnavailableIntegration t={t} title={t('set_notifications')} body={t('set_notif_unavailable')} />;
}

function AppearanceSection({ t, locale, setLocale }) {
  const { themeMode, themeEff, setTheme, scenePref, setScenePref } = React.useContext(LifeLocaleContext);
  /* Scene override is meaningful only under paradise (dark/light have no
     day/night). When the effective theme isn't paradise, render the
     control disabled — same shape/size, just greyed + non-interactive. */
  const sceneOn = themeEff === 'paradise';
  /* Optional interface font — device-local; the logo never changes with it. */
  const [font, setFont] = useInterfaceFont();
  const fonts = [
    ['current', t('set_font_current')],
    ['dejavu',  t('set_font_dejavu')],
  ];
  const scenes = [
    ['auto',  t('set_scene_auto')],
    ['day',   t('set_scene_day')],
    ['night', t('set_scene_night')],
  ];
  return (
    <React.Fragment>
      <Row label={t('set_theme')}>
        <div className="set-seg set-seg-theme">
          <button className={"set-seg-btn" + (themeMode === 'dark' ? " is-on" : "")}
                  onClick={() => setTheme('dark')}>
            <ThemeGlyph kind="dark" />
            <span>{t('set_theme_dark')}</span>
          </button>
          <button className={"set-seg-btn" + (themeMode === 'light' ? " is-on" : "")}
                  onClick={() => setTheme('light')}>
            <ThemeGlyph kind="light" />
            <span>{t('set_theme_light')}</span>
          </button>
          <button className={"set-seg-btn" + (themeMode === 'paradise' ? " is-on" : "")}
                  onClick={() => setTheme('paradise')}>
            <ThemeGlyph kind="paradise" />
            <span>{t('set_theme_paradise')}</span>
          </button>
          <button className={"set-seg-btn set-seg-btn-system" + (themeMode === 'system' ? " is-on" : "")}
                  onClick={() => setTheme('system')}
                  title={"auto · " + themeEff}>
            <ThemeGlyph kind="system" />
            <span>{t('set_theme_system')}</span>
            <span className="set-seg-auto mono">AUTO</span>
          </button>
        </div>
      </Row>
      <Row label={t('set_scene')} hint={sceneOn ? null : t('set_scene_paradise_only')}>
        <div className={"set-seg" + (sceneOn ? "" : " is-disabled")}>
          {scenes.map(([val, lbl]) => (
            <button key={val}
                    className={"set-seg-btn" + (scenePref === val ? " is-on" : "") + (sceneOn ? "" : " is-disabled")}
                    disabled={!sceneOn}
                    onClick={() => sceneOn && setScenePref(val)}>{lbl}</button>
          ))}
        </div>
      </Row>
      <Row label={t('set_lang')}>
        <div className="set-seg">
          {LifeLocales.map(loc => (
            <button key={loc} className={"set-seg-btn" + (locale === loc ? " is-on" : "")} onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
          ))}
        </div>
      </Row>
      <Row label={t('set_font')}>
        <div className="set-seg" role="group" aria-label={t('set_font')}>
          {fonts.map(([val, lbl]) => (
            <button key={val}
                    className={"set-seg-btn" + (font === val ? " is-on" : "")}
                    aria-pressed={font === val}
                    onClick={() => setFont(val)}>{lbl}</button>
          ))}
        </div>
      </Row>
      <Row label={t('set_font_preview')}>
        <div className="set-font-preview">
          {fonts.map(([val, lbl]) => (
            <div key={val} className={"set-font-sample is-" + val}>
              <span className="set-font-sample-label mono">{lbl}</span>
              <span className="set-font-sample-text" lang={locale}>{t('set_font_sample')}</span>
            </div>
          ))}
        </div>
      </Row>
    </React.Fragment>
  );
}

/* Theme glyph — 14px. Dark = filled moon, light = sun, system = half-and-half
   (left half moon-fill, right half sun-rays). Gives the segmented control a
   visual signal beyond the label, so "системная" is identifiable even when
   it resolves to dark and matches "тёмная" textually. */
function ThemeGlyph({ kind }) {
  if (kind === 'dark') {
    return (
      <svg className="set-seg-glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M11.2 8.6A4.4 4.4 0 0 1 5.4 2.8a4.6 4.6 0 1 0 5.8 5.8z" fill="currentColor"/>
      </svg>
    );
  }
  if (kind === 'light') {
    return (
      <svg className="set-seg-glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="7" cy="7" r="2.6"/>
        <path d="M7 1.4v1.6M7 11v1.6M1.4 7h1.6M11 7h1.6M3.1 3.1l1.1 1.1M9.8 9.8l1.1 1.1M3.1 10.9l1.1-1.1M9.8 4.2l1.1-1.1"/>
      </svg>
    );
  }
  if (kind === 'paradise') {
    /* palm tree — stroke style matches the sun glyph (1.4 / round caps) */
    return (
      <svg className="set-seg-glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M7.4 12.4c-.1-2.9.3-5.2 1.2-7"/>
        <path d="M8.6 5.4C7.1 4.2 5.3 4.1 3.9 5"/>
        <path d="M8.6 5.4c1.6-1 3.3-.8 4.4.3"/>
        <path d="M8.6 5.4C8 3.7 6.8 2.7 5.2 2.6"/>
        <path d="M8.6 5.4c.6-1.7 1.9-2.6 3.4-2.5"/>
      </svg>
    );
  }
  // system — split disc: left half solid (night), right half hollow with center sun
  return (
    <svg className="set-seg-glyph" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.4a5.6 5.6 0 0 0 0 11.2V1.4z" fill="currentColor"/>
      <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  );
}

export { SettingsPage, AppearanceSection };
/* Re-exported for callers and tests that import it from the page. */
export { ExportSection };
