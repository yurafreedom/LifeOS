/* global React */
const { useState: useStateSet, useContext: useCtxSet } = React;

function SettingsPage() {
  const { t, locale, setLocale } = useCtxSet(window.LifeLocaleContext);
  const I = window.LIcons;

  const sections = [
    { id: 'account',       label: t('set_account') },
    { id: 'categories',    label: t('set_categories') },
    { id: 'telegram',      label: t('set_telegram') },
    { id: 'monobank',      label: t('set_monobank') },
    { id: 'notifications', label: t('set_notifications') },
    { id: 'appearance',    label: t('set_appearance') },
    { id: 'export',        label: t('set_export') },
    { id: 'danger',        label: t('set_danger') },
  ];
  const [sel, setSel] = useStateSet('account');

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
          {sel === 'categories'    && <CategoriesSection t={t} locale={locale}/>}
          {sel === 'telegram'      && <TelegramSection t={t}/>}
          {sel === 'monobank'      && <MonobankSection t={t}/>}
          {sel === 'notifications' && <NotificationsSection t={t}/>}
          {sel === 'appearance'    && <AppearanceSection t={t} locale={locale} setLocale={setLocale}/>}
          {sel === 'export'        && <ExportSection t={t}/>}
          {sel === 'danger'        && <DangerSection t={t}/>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-row-left">
        <div className="set-row-label">{label}</div>
        {hint && <div className="set-row-hint mono">{hint}</div>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

function AccountSection({ t }) {
  return (
    <React.Fragment>
      <Row label={t('set_account_name')}><input className="set-input" defaultValue="dogfood"/></Row>
      <Row label={t('set_account_email')} hint="read-only"><input className="set-input is-readonly" readOnly defaultValue="me@life.os"/></Row>
    </React.Fragment>
  );
}

function CategoriesSection({ t, locale }) {
  const cats = window.LifeCategories;
  const data = React.useContext(window.LifeDataContext);
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
                <span className={"qa-cat-dot " + window.LifeCatTintClass[c.tint]}>
                  {window.LIcons[c.icon] && window.LIcons[c.icon]({ size: 12 })}
                </span>
                <span>{c.name[locale]}</span>
              </div>
              <div className="set-table-cell mono">
                {c.kind === 'expense' ? '$' + (100 + (c.id.length * 20)) : '—'}
              </div>
              <div className="set-table-cell set-table-cell-eye">
                <window.EyeToggle
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
        <button className="set-add-row mono">{t('set_cat_add')}</button>
      </div>
    </React.Fragment>
  );
}

function TelegramSection({ t }) {
  return (
    <React.Fragment>
      <Row label={t('set_tg_token')} hint="hidden when set">
        <input className="set-input mono" type="password" defaultValue="1234567:AAAAAAAA-bot-token-masked"/>
      </Row>
      <Row label={t('set_tg_chat')}><input className="set-input mono" defaultValue="123456789"/></Row>
      <Row label="">
        <button className="set-btn-primary">{t('set_tg_test')}</button>
      </Row>
      <div className="set-subhead mono">RULES</div>
      <Row label={t('set_notif_bot')}><Toggle on={true}/></Row>
      <Row label={t('set_notif_goal')}><Toggle on={true}/></Row>
      <Row label={t('set_notif_streak')}><Toggle on={true}/></Row>
    </React.Fragment>
  );
}

function MonobankSection({ t }) {
  return (
    <React.Fragment>
      <Row label={t('set_mono_token')}>
        <input className="set-input mono" type="password" defaultValue="uXXXXXXXXXXXXXXXX-monobank-token-masked"/>
      </Row>
      <Row label={t('set_mono_last')} hint={t('set_mono_pending', 7) + ' · ' + t.pl('pl_tx', 7)}>
        <span className="mono set-mono-time">2026-05-21 14:02</span>
      </Row>
      <Row label="">
        <button className="set-btn-primary">{t('set_mono_sync')}</button>
      </Row>
    </React.Fragment>
  );
}

function NotificationsSection({ t }) {
  return (
    <React.Fragment>
      <Row label={t('set_notif_goal')}><Toggle on={true}/></Row>
      <Row label={t('set_notif_budget')}><Toggle on={true}/></Row>
      <Row label={t('set_notif_streak')}><Toggle on={true}/></Row>
      <Row label={t('set_notif_bot')}><Toggle on={false}/></Row>
      <Row label={t('set_quiet_hours')} hint="22:00 → 09:00">
        <span className="mono set-mono-time">22:00 — 09:00</span>
      </Row>
    </React.Fragment>
  );
}

function AppearanceSection({ t, locale, setLocale }) {
  const { themeMode, themeEff, setTheme } = React.useContext(window.LifeLocaleContext);
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
      <Row label={t('set_lang')}>
        <div className="set-seg">
          {window.LifeLocales.map(loc => (
            <button key={loc} className={"set-seg-btn" + (locale === loc ? " is-on" : "")} onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
          ))}
        </div>
      </Row>
      <Row label={t('set_accent_intensity')} hint="100%">
        <input type="range" className="set-range" min="50" max="120" defaultValue="100"/>
      </Row>
      <Row label={t('set_density')}>
        <div className="set-seg">
          <button className="set-seg-btn is-on">{t('set_density_cozy')}</button>
          <button className="set-seg-btn">{t('set_density_compact')}</button>
        </div>
      </Row>
    </React.Fragment>
  );
}

function ExportSection({ t }) {
  return (
    <React.Fragment>
      <Row label={t('set_export_json')} hint=".json · 184 KB"><button className="set-btn-ghost">download</button></Row>
      <Row label={t('set_export_csv')}  hint=".csv · 12 KB"><button className="set-btn-ghost">download</button></Row>
      <Row label={t('set_export_md')}   hint=".md · 24 KB"><button className="set-btn-ghost">download</button></Row>
    </React.Fragment>
  );
}

function DangerSection({ t }) {
  const data = React.useContext(window.LifeDataContext);
  const [confirmCount, setConfirmCount] = useStateSet(null);   // months -> shows confirm row
  const [feedback, setFeedback]         = useStateSet('');

  function exportJson() {
    if (!data) return;
    const blob = new Blob([data.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifeOsState.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearHistory(months) {
    if (!data) return;
    const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString();
    const before = (data.state.activityLog || []).length;
    data.clearActivityOlderThan(cutoff);
    const after = Math.max(0, before - 0);   // we don't know after value synchronously
    /* approximate — we count rows older than the cutoff right now */
    const removed = (data.state.activityLog || []).filter(e => new Date(e.timestamp).getTime() < new Date(cutoff).getTime()).length;
    setFeedback(t('set_clear_done', removed));
    setConfirmCount(null);
    setTimeout(() => setFeedback(''), 3000);
  }

  return (
    <React.Fragment>
      <div className="set-danger-card">
        <div className="set-danger-msg">{t('set_danger_msg')}</div>
        <button className="set-btn-danger">{t('set_danger_btn')}</button>
      </div>

      <div className="set-subhead mono">SPRINT 3A · STATE</div>
      <Row label={t('set_export_state')} hint={t('set_export_state_hint')}>
        <button className="set-btn-ghost" onClick={exportJson}>{t('set_export_json')} ↓</button>
      </Row>
      <Row label={t('set_clear_history')} hint={t('set_clear_history_hint')}>
        <div className="set-seg">
          <button className={"set-seg-btn" + (confirmCount === 3  ? " is-on" : "")} onClick={() => setConfirmCount(3)}>{t('set_clear_3mo')}</button>
          <button className={"set-seg-btn" + (confirmCount === 6  ? " is-on" : "")} onClick={() => setConfirmCount(6)}>{t('set_clear_6mo')}</button>
          <button className={"set-seg-btn" + (confirmCount === 12 ? " is-on" : "")} onClick={() => setConfirmCount(12)}>{t('set_clear_12mo')}</button>
        </div>
      </Row>
      {confirmCount != null && (
        <Row label="" hint={feedback || ''}>
          <div className="set-clear-confirm">
            <button className="set-btn-ghost" onClick={() => setConfirmCount(null)}>{t('qa_cancel')}</button>
            <button className="set-btn-danger" onClick={() => clearHistory(confirmCount)}>{t('set_clear_do')}</button>
          </div>
        </Row>
      )}
      {feedback && confirmCount == null && (
        <div className="set-subhead mono" style={{ color: 'var(--success)' }}>{feedback}</div>
      )}
    </React.Fragment>
  );
}

function Toggle({ on }) {
  const [v, setV] = useStateSet(on);
  return (
    <button className={"set-toggle" + (v ? " is-on" : "")} onClick={() => setV(!v)}>
      <span className="set-toggle-knob"/>
    </button>
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

window.SettingsPage = SettingsPage;
