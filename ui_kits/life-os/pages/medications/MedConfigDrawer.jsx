/* global React */
/* pages/medications/MedConfigDrawer.jsx · Sprint 3A Batch 3
 *
 * Right-side slide-in panel for editing a medication's configuration.
 * Five collapsible sections:
 *   1. ОСНОВНОЕ — status, dose, schedule
 *   2. ИНТЕРВАЛ — dose_interval_h, half_life
 *   3. СТРАТЕГИЯ ПРИЁМА — steady / up / down / prn
 *   4. ЗАПАСЫ — inventory_count, low_stock_threshold_days
 *   5. УДАЛИТЬ ПРЕПАРАТ — soft delete to 'archived'
 *
 * Edits live in local draft state; nothing persists until Save. When
 * the mode strategy changes AND ≥1 other med had mode_changed in the
 * last 7 days, MultiChangeWarningModal interrupts. */

const { useState: useStateCD, useEffect: useEffectCD, useContext: useCtxCD, useMemo: useMemoCD } = React;

function MedConfigDrawer({ med, onClose }) {
  const data   = useCtxCD(window.LifeDataContext);
  const { t, locale } = useCtxCD(window.LifeLocaleContext);
  const I = window.LIcons;

  /* Initial mode style — if none set, infer 'steady' as the default
     so the radio always has a selection. */
  const liveMode = data.state.modeStyles[med.id];
  const [draft, setDraft] = useStateCD(() => ({
    status:                       med.status || 'active',
    current_dose_mg_per_day:      med.current_dose_mg_per_day || 0,
    dose_unit:                    med.is_supplement ? 'caps' : 'mg',
    doses_per_day:                med.doses_per_day || 1,
    schedule:                     Array.isArray(med.schedule) ? med.schedule.slice() : [],
    dose_interval_h:              med.dose_interval_h || 24,
    half_life_h:                  med.half_life_h || '',
    half_life_active_metabolite_h:med.half_life_active_metabolite_h || '',
    inventory_count:              med.inventory_count || 0,
    low_stock_threshold_days:     med.low_stock_threshold_days || 7,
  }));
  const [mode, setMode] = useStateCD(() => liveMode
    ? { ...liveMode }
    : { type: 'steady' });

  const [confirmDel, setConfirmDel] = useStateCD(false);
  const [warnState, setWarnState]   = useStateCD(null);   // null | { recentChanges, onConfirm }

  /* Close on Esc */
  useEffectCD(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;

  function patchDraft(p) { setDraft(d => ({ ...d, ...p })); }
  function patchMode(p)  { setMode(m => ({ ...m, ...p })); }

  function addScheduleSlot() {
    patchDraft({ schedule: [...draft.schedule, '08:00'] });
  }
  function removeScheduleSlot(i) {
    patchDraft({ schedule: draft.schedule.filter((_, idx) => idx !== i) });
  }
  function setScheduleSlot(i, value) {
    patchDraft({ schedule: draft.schedule.map((s, idx) => idx === i ? value : s) });
  }

  function commitAll() {
    /* persist med fields + status */
    data.updateMedication(med.id, {
      status:                       draft.status,
      current_dose_mg_per_day:      Number(draft.current_dose_mg_per_day) || 0,
      doses_per_day:                Number(draft.doses_per_day) || 0,
      schedule:                     draft.schedule.slice(),
      dose_interval_h:              Number(draft.dose_interval_h) || null,
      half_life_h:                  draft.half_life_h === '' ? null : Number(draft.half_life_h),
      half_life_active_metabolite_h: draft.half_life_active_metabolite_h === '' ? null : Number(draft.half_life_active_metabolite_h),
      inventory_count:              Number(draft.inventory_count) || 0,
      low_stock_threshold_days:     Number(draft.low_stock_threshold_days) || 7,
    });
    /* persist mode style if it changed */
    if (modeChanged(liveMode, mode)) {
      data.setModeStyle(med.id, mode);
    }
    onClose();
  }

  function trySave() {
    /* Multi-change warning: only when MODE has changed AND at least one
       OTHER medication had a mode_changed activity in the past 7 days. */
    if (modeChanged(liveMode, mode)) {
      const recent = recentOtherModeChanges(data.state, med.id, locale);
      if (recent.length > 0) {
        setWarnState({ recentChanges: recent });
        return;
      }
    }
    commitAll();
  }

  function deleteSoft() {
    data.deleteMedication(med.id);
    onClose();
  }

  /* Up/down titration preview line — show first 3 stages + target. */
  const titrationPreview = useMemoCD(() => {
    if (mode.type !== 'up' && mode.type !== 'down') return null;
    const start = Number(draft.current_dose_mg_per_day) || 0;
    const target = Number(mode.target_dose_mg) || 0;
    const step = Number(mode.step_size_mg) || 0;
    const interval = Number(mode.step_interval_days) || 0;
    if (!start || !target || !step || !interval) return null;
    const dir = mode.type === 'up' ? 1 : -1;
    const stages = [];
    let v = start;
    let day = 0;
    while (stages.length < 6 && (dir > 0 ? v < target : v > target)) {
      stages.push({ day, dose: v });
      v = Math.max(0, v + dir * step);
      day += interval;
    }
    stages.push({ day, dose: target, target: true });
    return { stages, totalDays: day, target };
  }, [mode, draft.current_dose_mg_per_day]);

  /* Progress on titration (mock — driven from modeStyle.startedAt) */
  const titrationProgress = useMemoCD(() => {
    if (!titrationPreview || !liveMode || !liveMode.startedAt) return null;
    const elapsed = (Date.now() - new Date(liveMode.startedAt).getTime()) / 86400000;
    const dayInt = Math.floor(elapsed);
    const total = titrationPreview.totalDays;
    if (total <= 0) return null;
    const stepInterval = Number(mode.step_interval_days) || 7;
    const stageIdx = Math.min(titrationPreview.stages.length - 1, Math.floor(dayInt / stepInterval));
    const stage = titrationPreview.stages[stageIdx];
    return { day: dayInt, total, stage };
  }, [titrationPreview, liveMode, mode.step_interval_days]);

  const scheduleMismatch = draft.schedule.length > 0 && draft.schedule.length !== Number(draft.doses_per_day);

  return (
    <div className="mcd-backdrop" onMouseDown={onClose}>
      <aside className="mcd-panel" onMouseDown={e => e.stopPropagation()} role="dialog">
        <header className="mcd-head">
          <div>
            <div className="mcd-eyebrow mono">{t('mcd_title', '').trim()}</div>
            <h3 className="mcd-name">{medName}</h3>
          </div>
          <button className="qa-close" onClick={onClose}>{I.x ? I.x({ size: 14 }) : '×'}</button>
        </header>

        <div className="mcd-body">
          {/* 1. BASIC */}
          <Section label={t('mcd_sec_basic')}>
            <Row label={t('mcd_status')}>
              <select className="tdm-input mcd-select" value={draft.status} onChange={e => patchDraft({ status: e.target.value })}>
                <option value="active">{t('meds_status_active')}</option>
                <option value="inactive">{t('meds_status_inactive')}</option>
                <option value="planned">{t('meds_status_planned')}</option>
                <option value="considering">{t('meds_status_considering')}</option>
              </select>
            </Row>
            <Row label={t('mcd_dose_current')}>
              <div className="mcd-inline">
                <input className="tdm-input mcd-num" type="number" min="0" step="5"
                  value={draft.current_dose_mg_per_day}
                  onChange={e => patchDraft({ current_dose_mg_per_day: e.target.value })} />
                <select className="tdm-input mcd-select-sm" value={draft.dose_unit}
                  onChange={e => patchDraft({ dose_unit: e.target.value })}>
                  <option value="mg">{t('mcd_dose_unit_mg')}</option>
                  <option value="caps">{t('mcd_dose_unit_caps')}</option>
                  <option value="ml">{t('mcd_dose_unit_ml')}</option>
                </select>
              </div>
            </Row>
            <Row label={t('mcd_doses_per_day')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="1"
                value={draft.doses_per_day}
                onChange={e => patchDraft({ doses_per_day: e.target.value })} />
            </Row>
            <Row label={t('mcd_schedule')}>
              <div className="mcd-schedule">
                {draft.schedule.map((slot, i) => (
                  <div key={i} className="mcd-schedule-slot">
                    <input type="time" className="tdm-input mcd-time"
                      value={slot}
                      onChange={e => setScheduleSlot(i, e.target.value)} />
                    <button className="mcd-x" onClick={() => removeScheduleSlot(i)} title="remove">×</button>
                  </div>
                ))}
                <button className="mcd-add-slot mono" onClick={addScheduleSlot}>{t('mcd_schedule_add')}</button>
              </div>
            </Row>
            {scheduleMismatch && (
              <div className="mcd-warn mono">{t('mcd_schedule_mismatch', draft.schedule.length, draft.doses_per_day)}</div>
            )}
          </Section>

          {/* 2. INTERVAL */}
          <Section label={t('mcd_sec_interval')}>
            <Row label={t('mcd_interval_dose')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="1"
                value={draft.dose_interval_h}
                onChange={e => patchDraft({ dose_interval_h: e.target.value })} />
            </Row>
            <Row label={t('mcd_interval_halflife')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="0.5"
                value={draft.half_life_h}
                onChange={e => patchDraft({ half_life_h: e.target.value })} />
            </Row>
            <Row label={t('mcd_interval_metab')} hint={t('mcd_metab_hint')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="1"
                value={draft.half_life_active_metabolite_h}
                onChange={e => patchDraft({ half_life_active_metabolite_h: e.target.value })} />
            </Row>
          </Section>

          {/* 3. STRATEGY */}
          <Section label={t('mcd_sec_strategy')}>
            <div className="mcd-radio-list">
              <ModeRadio value="steady" current={mode.type} label={t('mcd_mode_steady')} hint={t('mcd_mode_steady_hint')}
                onSelect={() => setMode({ type: 'steady' })} />
              <ModeRadio value="up" current={mode.type} label={t('mcd_mode_up')}
                onSelect={() => setMode({ type: 'up', target_dose_mg: mode.target_dose_mg || '', step_type: mode.step_type || 'linear', step_size_mg: mode.step_size_mg || 25, step_interval_days: mode.step_interval_days || 7 })}>
                {mode.type === 'up' && (
                  <TitrationFields mode={mode} patchMode={patchMode} t={t} preview={titrationPreview} progress={titrationProgress} />
                )}
              </ModeRadio>
              <ModeRadio value="down" current={mode.type} label={t('mcd_mode_down')}
                onSelect={() => {
                  const tpl = med.discontinuation_template;
                  setMode({
                    type: 'down',
                    target_dose_mg: mode.target_dose_mg || (tpl ? tpl.target : 0),
                    step_type: mode.step_type || 'linear',
                    step_size_mg: mode.step_size_mg || (tpl ? tpl.step : 25),
                    step_interval_days: mode.step_interval_days || (tpl ? tpl.interval_days : 14),
                  });
                }}>
                {mode.type === 'down' && (
                  <TitrationFields mode={mode} patchMode={patchMode} t={t} preview={titrationPreview} progress={titrationProgress} />
                )}
              </ModeRadio>
              <ModeRadio value="prn" current={mode.type} label={t('mcd_mode_prn')} hint={t('mcd_mode_prn_hint')}
                onSelect={() => setMode({ type: 'prn' })} />
            </div>
          </Section>

          {/* 4. INVENTORY */}
          <Section label={t('mcd_sec_inventory')}>
            <Row label={t('mcd_inv_count')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="1"
                value={draft.inventory_count}
                onChange={e => patchDraft({ inventory_count: e.target.value })} />
            </Row>
            <Row label={t('mcd_inv_threshold')}>
              <input className="tdm-input mcd-num" type="number" min="0" step="1"
                value={draft.low_stock_threshold_days}
                onChange={e => patchDraft({ low_stock_threshold_days: e.target.value })} />
            </Row>
          </Section>

          {/* 5. DELETE */}
          <Section label={t('mcd_sec_delete')} danger>
            <div className="mcd-delete-row">
              <div className="mcd-delete-msg">{t('mcd_delete_msg')}</div>
              {!confirmDel ? (
                <button className="mcd-btn-danger" onClick={() => setConfirmDel(true)}>{t('mcd_delete_btn')}</button>
              ) : (
                <div className="mcd-delete-confirm">
                  <span className="mono mcd-confirm-q">{t('mcd_delete_confirm')}</span>
                  <button className="qa-btn-ghost" onClick={() => setConfirmDel(false)}>{t('qa_cancel')}</button>
                  <button className="mcd-btn-danger" onClick={deleteSoft}>{t('mcd_delete_btn')}</button>
                </div>
              )}
            </div>
          </Section>
        </div>

        <footer className="mcd-foot">
          <button className="qa-btn-ghost" onClick={onClose}>{t('mcd_close')}</button>
          <button className="qa-btn-save" onClick={trySave}>{t('mcd_save')}</button>
        </footer>
      </aside>

      {warnState && (
        <window.MultiChangeWarningModal
          recentChanges={warnState.recentChanges}
          currentMed={med}
          onCancel={() => setWarnState(null)}
          onProceed={() => { setWarnState(null); commitAll(); }} />
      )}
    </div>
  );
}

function Section({ label, danger, children }) {
  return (
    <section className={"mcd-section" + (danger ? " is-danger" : "")}>
      <div className="mcd-section-head mono">{label}</div>
      <div className="mcd-section-body">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="mcd-row">
      <div className="mcd-row-left">
        <div className="mcd-row-label">{label}</div>
        {hint && <div className="mcd-row-hint mono">{hint}</div>}
      </div>
      <div className="mcd-row-control">{children}</div>
    </div>
  );
}

function ModeRadio({ value, current, label, hint, onSelect, children }) {
  const active = current === value;
  return (
    <div className={"mcd-radio" + (active ? " is-on" : "")}>
      <button className="mcd-radio-trigger" onClick={onSelect}>
        <span className={"mcd-radio-dot" + (active ? " is-on" : "")} />
        <span className="mcd-radio-label">{label}</span>
        {hint && <span className="mcd-radio-hint mono">{hint}</span>}
      </button>
      {active && children && (
        <div className="mcd-radio-body">{children}</div>
      )}
    </div>
  );
}

function TitrationFields({ mode, patchMode, t, preview, progress }) {
  return (
    <div className="mcd-titration">
      <div className="mcd-titration-grid">
        <label className="mcd-tf">
          <span className="mcd-row-label">{t('mcd_target_dose')}</span>
          <input className="tdm-input mcd-num" type="number" min="0" step="5"
            value={mode.target_dose_mg || ''}
            onChange={e => patchMode({ target_dose_mg: e.target.value })} />
        </label>
        <label className="mcd-tf">
          <span className="mcd-row-label">{t('mcd_step_type')}</span>
          <select className="tdm-input mcd-select" value={mode.step_type || 'linear'}
            onChange={e => patchMode({ step_type: e.target.value })}>
            <option value="linear">{t('mcd_step_linear')}</option>
            <option value="stepwise">{t('mcd_step_stepwise')}</option>
            <option value="custom">{t('mcd_step_custom')}</option>
          </select>
        </label>
        <label className="mcd-tf">
          <span className="mcd-row-label">{t('mcd_step_size')}</span>
          <input className="tdm-input mcd-num" type="number" min="0" step="5"
            value={mode.step_size_mg || ''}
            onChange={e => patchMode({ step_size_mg: e.target.value })} />
        </label>
        <label className="mcd-tf">
          <span className="mcd-row-label">{t('mcd_step_interval')}</span>
          <input className="tdm-input mcd-num" type="number" min="0" step="1"
            value={mode.step_interval_days || ''}
            onChange={e => patchMode({ step_interval_days: e.target.value })} />
        </label>
      </div>

      {preview && (
        <div className="mcd-preview mono">
          <span className="mcd-preview-lab">{t('mcd_titration_plan')}</span>
          {preview.stages.map((s, i) => (
            <span key={i} className={"mcd-preview-stage" + (s.target ? " is-target" : "")}>
              {s.dose}мг
              {i > 0 ? ' (день ' + s.day : ''}
              {s.target ? ', ' + t('mcd_titration_target') + ')' : (i > 0 ? ')' : '')}
              {i < preview.stages.length - 1 && <span className="mcd-preview-arrow"> → </span>}
            </span>
          ))}
        </div>
      )}

      {progress && (
        <div className="mcd-progress">
          <div className="mcd-progress-track">
            <div className="mcd-progress-fill"
              style={{ width: Math.min(100, (progress.day / progress.total) * 100) + '%' }} />
          </div>
          <div className="mcd-progress-lab mono">
            {t('mcd_titration_stage', progress.day, progress.total, progress.stage.dose)}
          </div>
        </div>
      )}
    </div>
  );
}

function modeChanged(a, b) {
  if (!a && b && b.type === 'steady') return false;        // initial null + default steady = no change
  if (!a) return true;
  return JSON.stringify(stripStarted(a)) !== JSON.stringify(stripStarted(b));
}
function stripStarted(m) {
  if (!m) return m;
  const { startedAt, currentStage, ...rest } = m;
  return rest;
}

function recentOtherModeChanges(state, excludeMedId, locale) {
  const cutoff = Date.now() - 7 * 86400000;
  const seen = new Map();
  /* activityLog is oldest-first internally — newest at end. Iterate in
     reverse so the first sighting per med is the most recent. */
  const log = state.activityLog || [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e.action !== 'mode_changed') continue;
    if (e.entity_id === excludeMedId) continue;
    if (new Date(e.timestamp).getTime() < cutoff) continue;
    if (!seen.has(e.entity_id)) seen.set(e.entity_id, e);
  }
  return Array.from(seen.values()).map(e => {
    const m = (state.medications || []).find(mm => mm.id === e.entity_id);
    return {
      ...e,
      medName: m ? (m['name_' + (locale === 'uk' ? 'ua' : 'ru')] || m.name_ru) : e.entity_id,
    };
  });
}

window.MedConfigDrawer = MedConfigDrawer;
