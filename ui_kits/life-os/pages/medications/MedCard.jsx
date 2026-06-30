/* global React */
/* pages/medications/MedCard.jsx · Sprint 3A Batch 2
 *
 * Per-medication card with 3 live timers, action row, inventory chip.
 * Clicking the card body opens the per-med detail page (Batch 4).
 * Clicking [принял] opens TakeDoseModal; [⚙] opens MedConfigDrawer (Batch 3).
 *
 * Timers tick once per 30s via the useNow hook. The two static timers
 * (t½, full elimination) recompute on the same tick — cheap, keeps
 * code branchless. */

const { useState: useStateMC, useEffect: useEffectMC, useContext: useCtxMC } = React;

function useNow(intervalMs) {
  const [now, setNow] = useStateMC(() => Date.now());
  useEffectMC(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs || 30000);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function MedCard({ med, onOpenTake, onOpenConfig, onOpenRefill, onOpenDetail }) {
  const data = useCtxMC(window.LifeDataContext);
  const { t, locale } = useCtxMC(window.LifeLocaleContext);
  const M = window.LifeMedMath;
  const I = window.LIcons;
  const now = useNow(30000);

  const doseLog = data.state.doseLogs[med.id] || [];
  const modeStyle = data.state.modeStyles[med.id] || null;
  const isPRN = modeStyle && modeStyle.type === 'prn';
  const supp = med.is_supplement === true;

  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
  const unitH = t('meds_unit_h');
  const unitM = t('meds_unit_m');

  /* ── Timers ─────────────────────────────────────────── */
  const nd = M.nextDose(med, doseLog, modeStyle, now);
  const hl = M.halfLifeTimer(med, doseLog, now);
  const fe = M.fullEliminationTimer(med);
  const usual = M.usualTime(doseLog);
  const risk = M.inventoryRisk(med, modeStyle);

  /* ── Role chip (informational, NOT a stakes signal) ── */
  const role = roleChip(med.cyp2d6_role, t);

  /* ── Mode badge in header (steady / titration / PRN) ── */
  const modeBadge = renderModeBadge(modeStyle, t);

  /* Inactive cards (planned/considering/inactive/archived) get
     dimmed treatment and disable timer rendering. Spec lets the
     filter chips control which statuses are visible, so by default
     we only render active ones — but the parent passes whatever
     status the filter resolved to. */
  const inactive = med.status !== 'active';

  const totalDose = med.current_dose_mg_per_day;
  const subtitle = [med.brand_common, role ? role.label : null].filter(Boolean).join(' · ');

  function cardBodyClick(e) {
    if (e.target.closest('.medc-action, .medc-config, .medc-refill, .medc-img')) return;
    if (onOpenDetail) onOpenDetail(med.id);
  }

  return (
    <div className={"medc" + (inactive ? " is-inactive" : "")} onClick={cardBodyClick}>
      <div className="medc-img">
        {med.image_path ? (
          <img src={med.image_path} alt="" />
        ) : (
          <div className="medc-img-fallback" aria-hidden="true">
            <PillGlyph />
          </div>
        )}
      </div>

      <div className="medc-body">
        <div className="medc-head">
          <div className="medc-id">
            <span className="medc-name">{medName}</span>
            {totalDose > 0 && (
              <span className="medc-dose mono">· {totalDose} мг/день</span>
            )}
            {supp && <span className="medc-supp mono">БАД</span>}
          </div>
          {modeBadge}
        </div>
        <div className="medc-sub mono">{subtitle}</div>

        <div className="medc-timers">
          {isPRN ? (
            <div className="medc-timer mono medc-timer-prn">
              <span className="medc-arrow">▸</span> {t('meds_prn_label')}
            </div>
          ) : nd ? (
            <div className="medc-timer mono">
              <span className="medc-arrow">▸</span>
              {nd.etaMs > 0
                ? t('meds_timer_next', M.formatHM(nd.etaMs, unitH, unitM), nd.eta)
                : t('meds_timer_now')}
            </div>
          ) : (
            <div className="medc-timer mono medc-timer-muted">
              <span className="medc-arrow">▸</span> {t('meds_no_doses_yet')}
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
        </div>

        {usual && (
          <div className="medc-usual mono">{t('meds_usual_time', usual)}</div>
        )}

        <div className="medc-actions">
          <button
            className="medc-action medc-action-take"
            disabled={risk.tier === 'empty'}
            onClick={(e) => { e.stopPropagation(); onOpenTake(med); }}>
            {t('meds_btn_take')}
          </button>
          <button
            className="medc-action medc-action-later"
            onClick={(e) => { e.stopPropagation(); data.snoozeDose(med.id, 1); }}>
            {t('meds_btn_later')}
          </button>
          <button
            className="medc-action medc-action-skip"
            onClick={(e) => { e.stopPropagation(); data.skipDose(med.id); }}>
            {t('meds_btn_skip')}
          </button>
          <button
            className="medc-config"
            title={t('meds_btn_config')}
            onClick={(e) => { e.stopPropagation(); onOpenConfig(med); }}>
            {I.settings ? I.settings({ size: 14 }) : '⚙'}
          </button>
        </div>

        <div className={"medc-inv medc-inv-" + risk.tier}>
          <span className="medc-inv-text mono">
            {inventoryText(med, risk, t, supp)}
          </span>
          {risk.chipKey && (
            <span className={"medc-inv-chip mono medc-inv-chip-" + risk.tier}>
              {t(risk.chipKey)}
            </span>
          )}
          <button
            className="medc-refill mono"
            onClick={(e) => { e.stopPropagation(); onOpenRefill(med); }}>
            {t('meds_inv_refill')}
          </button>
        </div>
      </div>
    </div>
  );
}

function inventoryText(med, risk, t, supp) {
  const count = med.inventory_count || 0;
  const days = risk.daysLeft != null ? Math.floor(risk.daysLeft) : null;
  if (days == null) return t('meds_inv_label_undef', count);
  const dayWord = t.pl('pl_meds_day', days);
  return supp
    ? t('meds_inv_label_caps', count, days, dayWord)
    : t('meds_inv_label',      count, days, dayWord);
}

function roleChip(role, t) {
  if (role === 'moderate_inhibitor') return { label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_moderate') };
  if (role === 'weak_inhibitor')     return { label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_weak') };
  if (role === 'strong_inhibitor')   return { label: t('meds_2d6_inhibitor') + ' · ' + t('meds_2d6_role_strong') };
  if (role === 'substrate_major')    return { label: t('meds_2d6_substrate') + ' · ' + t('meds_2d6_role_major') };
  if (role === 'substrate')          return { label: t('meds_2d6_substrate') };
  return null;
}

function renderModeBadge(modeStyle, t) {
  if (!modeStyle) return null;
  if (modeStyle.type === 'steady')    return <span className="medc-mode-badge medc-mode-steady mono">steady</span>;
  if (modeStyle.type === 'up')        return <span className="medc-mode-badge medc-mode-up mono">↑ titration</span>;
  if (modeStyle.type === 'down')      return <span className="medc-mode-badge medc-mode-down mono">↓ taper</span>;
  if (modeStyle.type === 'prn')       return <span className="medc-mode-badge medc-mode-prn mono">prn</span>;
  return null;
}

function PillGlyph() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <rect x="9" y="18" width="30" height="12" rx="6"
            fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="24" y1="18" x2="24" y2="30"
            stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

window.MedCard = MedCard;
