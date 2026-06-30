/* global React */
/* pages/medications/MedDetailPage.jsx · Sprint 3A Batch 4
 *
 * Full-route detail page for a single medication. Reached via
 * /medications/{med_id}. Hosts four tabs:
 *
 *   ОБЗОР           — at-a-glance card (timers + inventory mirror)
 *   ЖУРНАЛ          — per-med pharmacist notes (PharmNotes component)
 *   ИСТОРИЯ ДОЗ     — dose log timeline + activity events for this med
 *   КОНФИГУРАЦИЯ    — read-only summary + button that opens MedConfigDrawer
 *
 * The page rides the standard .page chrome so the global topbar and
 * sidebar remain visible. */

const { useState: useStateMD, useContext: useCtxMD, useMemo: useMemoMD } = React;

function MedDetailPage({ medId, onBack }) {
  const data = useCtxMD(window.LifeDataContext);
  const { t, locale } = useCtxMD(window.LifeLocaleContext);
  const I = window.LIcons;

  const med = (data.state.medications || []).find(m => m.id === medId);
  const [tab, setTab] = useStateMD('overview');
  const [openDrawer, setOpenDrawer] = useStateMD(false);

  if (!med) {
    return (
      <div className="page">
        <button className="medc-refill mono" onClick={onBack}>← {t('mdp_back')}</button>
        <div className="meds-empty mono">· препарат не найден ·</div>
      </div>
    );
  }

  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const statusLabels = window.LifeMedStatusLabels || {};
  const statusDef = statusLabels[med.status] || {};

  const tabs = [
    { id: 'overview', label: t('mdp_tab_overview') },
    { id: 'journal',  label: t('mdp_tab_journal') },
    { id: 'doses',    label: t('mdp_tab_doses') },
    { id: 'config',   label: t('mdp_tab_config') },
  ];

  return (
    <div className="page mdp-page">
      <button className="mdp-back mono" onClick={onBack}>← {t('mdp_back')}</button>

      <header className="page-head mdp-head">
        <div className="page-head-left">
          <h2 className="page-title">{medName}</h2>
          <div className="page-sub mono">{med.brand_common} · {statusDef[locale === 'uk' ? 'ua' : 'ru'] || med.status}</div>
        </div>
      </header>

      <div className="mdp-tabs">
        {tabs.map(tb => (
          <button key={tb.id}
                  className={"mdp-tab mono" + (tab === tb.id ? " is-on" : "")}
                  onClick={() => setTab(tb.id)}>
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mdp-tab-body">
        {tab === 'overview' && <OverviewTab med={med} />}
        {tab === 'journal'  && <window.PharmNotes medId={medId} />}
        {tab === 'doses'    && <DosesTab medId={medId} med={med} />}
        {tab === 'config'   && <ConfigTab med={med} onOpenDrawer={() => setOpenDrawer(true)} />}
      </div>

      {openDrawer && (
        <window.MedConfigDrawer med={med} onClose={() => setOpenDrawer(false)} />
      )}
    </div>
  );
}

/* ── Overview tab ───────────────────────────────────────── */
function OverviewTab({ med }) {
  const data = useCtxMD(window.LifeDataContext);
  const { t, locale } = useCtxMD(window.LifeLocaleContext);
  const M = window.LifeMedMath;
  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const now = Date.now();

  const nd = M.nextDose(med, doseLog, modeStyle, now);
  const hl = M.halfLifeTimer(med, doseLog, now);
  const fe = M.fullEliminationTimer(med);
  const usual = M.usualTime(doseLog);
  const risk = M.inventoryRisk(med, modeStyle);

  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');
  const notes = med['notes_' + (locale === 'uk' ? 'ua' : 'ru')] || med.notes_ru;

  return (
    <div className="mdp-overview">
      <div className="mdp-stat-grid">
        <div className="mdp-stat">
          <div className="mdp-stat-lab mono">текущая доза</div>
          <div className="mdp-stat-val">{med.current_dose_mg_per_day || '—'} <span className="mdp-stat-unit mono">мг/день</span></div>
        </div>
        <div className="mdp-stat">
          <div className="mdp-stat-lab mono">приёмов в день</div>
          <div className="mdp-stat-val">{med.doses_per_day || '—'}</div>
        </div>
        <div className="mdp-stat">
          <div className="mdp-stat-lab mono">t½</div>
          <div className="mdp-stat-val">{med.half_life_h != null ? med.half_life_h + 'ч' : '—'}</div>
        </div>
        <div className="mdp-stat">
          <div className="mdp-stat-lab mono">запас</div>
          <div className={"mdp-stat-val mdp-stat-risk-" + risk.tier}>{med.inventory_count || 0}</div>
        </div>
      </div>

      <div className="mdp-timers-card">
        {nd && (
          <div className="medc-timer mono">
            <span className="medc-arrow">▸</span>
            {nd.etaMs > 0
              ? t('meds_timer_next', M.formatHM(nd.etaMs, unitH, unitM), nd.eta)
              : t('meds_timer_now')}
          </div>
        )}
        {hl && (
          <div className="medc-timer mono medc-timer-muted">
            <span className="medc-arrow">▸</span>
            {t('meds_timer_halflife', hl.halfLifeH, hl.exitClock)}
          </div>
        )}
        {fe && (
          <div className="medc-timer mono medc-timer-muted">
            <span className="medc-arrow">▸</span>
            {fe.useMetabolite
              ? t('meds_timer_full_ddcar', fe.days, t.pl('pl_meds_day', fe.days))
              : t('meds_timer_full',        fe.days, t.pl('pl_meds_day', fe.days))}
          </div>
        )}
        {usual && (
          <div className="medc-usual mono">{t('meds_usual_time', usual)}</div>
        )}
      </div>

      {notes && (
        <div className="mdp-notes">{notes}</div>
      )}
    </div>
  );
}

/* ── Doses tab ──────────────────────────────────────────── */
function DosesTab({ medId, med }) {
  const data = useCtxMD(window.LifeDataContext);
  const { t, locale } = useCtxMD(window.LifeLocaleContext);
  const doseLog = data.state.doseLogs[medId] || [];

  if (doseLog.length === 0) {
    return <div className="pn-empty mono">{t('mdp_doses_empty')}</div>;
  }

  const intlLoc = (window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale) || 'ru-RU';

  return (
    <div className="mdp-doses">
      <ul className="pn-list">
        {doseLog.map((d, i) => {
          const dt = new Date(d.taken_at);
          const when = dt.toLocaleDateString(intlLoc, { day: '2-digit', month: '2-digit' })
                     + ' · ' + dt.toTimeString().slice(0, 5);
          return (
            <li key={d.taken_at + '/' + i} className="pn-row">
              <span className="pn-row-date mono">{when}</span>
              <span className="pn-row-text">
                {d.dose_mg != null ? d.dose_mg + ' мг' : t('dh_dose')}
                {d.mode && d.mode !== 'scheduled' && <span className="mdp-dose-mode mono"> · {d.mode}</span>}
              </span>
              {d.note && <span className="atl-detail">{d.note}</span>}
            </li>
          );
        })}
      </ul>

      <div className="mdp-section-head mono">activity log</div>
      <window.ActivityTimeline entityType="med_dose" entityId={medId} limit={100} />
      <window.ActivityTimeline entityType="med_config" entityId={medId} limit={50} />
      <window.ActivityTimeline entityType="mode_style" entityId={medId} limit={20} />
    </div>
  );
}

/* ── Config tab — read-only summary + drawer trigger ────── */
function ConfigTab({ med, onOpenDrawer }) {
  const { t, locale } = useCtxMD(window.LifeLocaleContext);
  const data = useCtxMD(window.LifeDataContext);
  const modeStyle = data.state.modeStyles[med.id] || null;

  const rows = [
    { lab: t('mcd_status'),            val: med.status },
    { lab: t('mcd_dose_current'),      val: (med.current_dose_mg_per_day || 0) + ' мг' },
    { lab: t('mcd_doses_per_day'),     val: med.doses_per_day || '—' },
    { lab: t('mcd_schedule'),          val: (med.schedule || []).join(', ') || '—' },
    { lab: t('mcd_interval_dose'),     val: med.dose_interval_h ? med.dose_interval_h + ' ч' : '—' },
    { lab: t('mcd_interval_halflife'), val: med.half_life_h != null ? med.half_life_h + ' ч' : '—' },
    { lab: t('mcd_sec_strategy'),      val: modeStyle ? modeStyle.type : 'steady (default)' },
    { lab: t('mcd_inv_count'),         val: med.inventory_count || 0 },
    { lab: t('mcd_inv_threshold'),     val: (med.low_stock_threshold_days || 7) + ' дн.' },
  ];

  return (
    <div className="mdp-config">
      <div className="mdp-config-grid">
        {rows.map((r, i) => (
          <div key={i} className="mdp-config-row">
            <span className="mdp-config-lab mono">{r.lab}</span>
            <span className="mdp-config-val">{r.val}</span>
          </div>
        ))}
      </div>
      <button className="qa-btn-save" onClick={onOpenDrawer}>
        {t('mdp_config_open_drawer')}
      </button>
    </div>
  );
}

window.MedDetailPage = MedDetailPage;
