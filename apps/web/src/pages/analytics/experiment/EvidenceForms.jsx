/* Experiment · evidence inputs. Each submit is one durable queue record; the
   page shows server truth plus a neutral «not yet confirmed» note, never an
   optimistic value. */

import React from 'react';
import { EPISTEMIC_KINDS } from '../../../analytics/review';
import { STORED_ADHERENCE, addDays, outcomeValue } from '../../../analytics/experimentFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { dateText } from './format.js';

const NUMBER = /^-?\d+(?:[.,]\d{1,6})?$/;

/** Elapsed, still-writable days: never a future day and never a day after a stop. */
export function writableDays(adherence) {
  return (adherence?.days ?? [])
    .filter(entry => entry.state !== 'future' && entry.state !== 'not_run_after_stop')
    .map(entry => entry.day);
}

function unitHint(outcome, t) {
  if (outcome.value_type === 'duration') return t('aa_ex_unit_minutes');
  if (outcome.value_type === 'money') return outcome.unit_code;
  if (outcome.value_type === 'scale') return t('aa_ex_unit_scale', outcome.scale_min, outcome.scale_max);
  return '';
}

export function AdherenceForm({ detail, pendingKeyFor, onRecord, busy = false }) {
  const t = useAAText();
  const days = writableDays(detail.adherence);
  const [chosen, setDay] = React.useState(null);
  // The newest writable day unless the user picked another that is still writable.
  const day = days.includes(chosen) ? chosen : days[days.length - 1] ?? '';
  if (!days.length) return <p className="aa-note">{t('aa_ex_adh_nothing_writable')}</p>;
  const entry = detail.adherence.days.find(item => item.day === day);
  function record(state) {
    // A day already answered is corrected by naming the answer it replaces —
    // the newest one, even if it is still waiting in the queue.
    const supersedes = pendingKeyFor(day) ?? entry?.record?.idempotency_key ?? null;
    onRecord(day, state, supersedes);
  }
  return <div className="aa-exp-form-row" role="group" aria-labelledby="exp-adh-title">
    <h4 className="aa-eyebrow" id="exp-adh-title">{t('aa_ex_adh_record_title')}</h4>
    <label className="aa-field">
      <span className="aa-quiet">{t('aa_ex_adh_day')}</span>
      <select className="aa-input" value={day} onChange={event => setDay(event.target.value)}>
        {days.map(item => <option key={item} value={item}>{dateText(item, t)}</option>)}
      </select>
    </label>
    {entry ? <p className="aa-quiet">{t('aa_ex_adh_now', t(`aa_ex_adh_${entry.state}`))}</p> : null}
    <div className="aa-choice aa-exp-adh-choice" role="group" aria-label={t('aa_ex_adh_record_title')}>
      {STORED_ADHERENCE.map(state => <button key={state} type="button" className="aa-choice-btn"
        disabled={busy} onClick={() => record(state)}>{t(`aa_ex_adh_set_${state}`)}</button>)}
    </div>
  </div>;
}

export function ObservationForm({ detail, onRecord, busy = false }) {
  const t = useAAText();
  const [role, setRole] = React.useState('outcome');
  const [num, setNum] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState(null);
  function submit(event) {
    event.preventDefault();
    if (role === 'outcome') {
      if (!NUMBER.test(num.trim())) { setError('aa_ex_err_number'); return; }
      onRecord({ role, label: detail.outcome.label, value: outcomeValue(detail.outcome, num) });
    } else {
      if (!label.trim()) { setError('aa_ex_err_required'); return; }
      const value = NUMBER.test(text.trim())
        ? { type: 'count', num: text.trim().replace(',', '.') }
        : text.trim() ? { type: 'categorical', text: text.trim() } : null;
      if (!value) { setError('aa_ex_err_required'); return; }
      onRecord({ role, label: label.trim(), value });
    }
    setError(null);
    setNum(''); setLabel(''); setText('');
  }
  return <form className="aa-exp-form-row" onSubmit={submit} aria-labelledby="exp-obs-title" noValidate>
    <h4 className="aa-eyebrow" id="exp-obs-title">{t('aa_ex_obs_record_title')}</h4>
    <div className="aa-choice aa-exp-inline" role="radiogroup" aria-label={t('aa_ex_obs_role')}>
      {['outcome', 'context'].map(option => <button key={option} type="button" role="radio"
        aria-checked={role === option} className={`aa-choice-btn${role === option ? ' is-on' : ''}`}
        onClick={() => setRole(option)}>{t(`aa_ex_obs_role_${option}`)}</button>)}
    </div>
    {role === 'outcome'
      ? <label className="aa-field">
        <span className="aa-quiet">{t('aa_ex_obs_outcome_value', detail.outcome.label)} · {unitHint(detail.outcome, t)}</span>
        <input className="aa-input" inputMode="decimal" value={num} onChange={event => setNum(event.target.value)} />
        <span className="aa-quiet">{t('aa_ex_obs_period_to_date')}</span>
      </label>
      : <>
        <label className="aa-field"><span className="aa-quiet">{t('aa_ex_obs_context_label')}</span>
          <input className="aa-input" maxLength={200} value={label} onChange={event => setLabel(event.target.value)} /></label>
        <label className="aa-field"><span className="aa-quiet">{t('aa_ex_obs_context_value')}</span>
          <input className="aa-input" maxLength={200} value={text} onChange={event => setText(event.target.value)} /></label>
      </>}
    {error ? <span className="aa-exp-error" role="alert">{t(error)}</span> : null}
    <div className="aa-actions-right"><button type="submit" className="aa-btn aa-btn-ghost" disabled={busy}>{t('aa_ex_save')}</button></div>
  </form>;
}

export function BaselineForm({ detail, onRecord, busy = false }) {
  const t = useAAText();
  const [num, setNum] = React.useState('');
  const [from, setFrom] = React.useState(addDays(detail.window.start, -14));
  const [to, setTo] = React.useState(addDays(detail.window.start, -1));
  const [basis, setBasis] = React.useState('');
  const [error, setError] = React.useState(null);
  function submit(event) {
    event.preventDefault();
    if (!NUMBER.test(num.trim())) { setError('aa_ex_err_number'); return; }
    if (!(from <= to && to < detail.window.start)) { setError('aa_ex_err_baseline_window'); return; }
    setError(null);
    onRecord({ value: outcomeValue(detail.outcome, num), windowStart: from, windowEnd: to, basis });
    setNum('');
  }
  return <form className="aa-exp-form-row" onSubmit={submit} aria-labelledby="exp-base-title" noValidate>
    <h4 className="aa-eyebrow" id="exp-base-title">{t('aa_ex_f_baseline')}</h4>
    <label className="aa-field"><span className="aa-quiet">{t('aa_ex_f_baseline_value')} · {unitHint(detail.outcome, t)}</span>
      <input className="aa-input" inputMode="decimal" value={num} onChange={event => setNum(event.target.value)} /></label>
    <div className="aa-exp-row">
      <label className="aa-field"><span className="aa-quiet">{t('aa_ex_f_baseline_from')}</span>
        <input type="date" className="aa-input" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label className="aa-field"><span className="aa-quiet">{t('aa_ex_f_baseline_to')}</span>
        <input type="date" className="aa-input" value={to} onChange={event => setTo(event.target.value)} /></label>
    </div>
    <label className="aa-field"><span className="aa-quiet">{t('aa_ex_f_basis')}</span>
      <input className="aa-input" maxLength={500} value={basis} onChange={event => setBasis(event.target.value)} /></label>
    {error ? <span className="aa-exp-error" role="alert">{t(error)}</span> : null}
    <div className="aa-actions-right"><button type="submit" className="aa-btn aa-btn-ghost" disabled={busy}>{t('aa_ex_save')}</button></div>
  </form>;
}

export function ConditionForm({ onRecord, busy = false }) {
  const t = useAAText();
  const [text, setText] = React.useState('');
  const [kind, setKind] = React.useState('observed');
  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onRecord({ text: text.trim(), epistemicKind: kind });
    setText('');
  }
  return <form className="aa-exp-form-row" onSubmit={submit} aria-labelledby="exp-cond-title">
    <h4 className="aa-eyebrow" id="exp-cond-title">{t('aa_ex_cond_record_title')}</h4>
    <label className="aa-field"><span className="aa-quiet">{t('aa_ex_cond_text')}</span>
      <input className="aa-input" maxLength={200} value={text} onChange={event => setText(event.target.value)} /></label>
    <label className="aa-field"><span className="aa-quiet">{t('aa_ex_cond_kind')}</span>
      <select className="aa-input" value={kind} onChange={event => setKind(event.target.value)}>
        {EPISTEMIC_KINDS.map(option => <option key={option} value={option}>{t(`aa_pr_kind_${option}`)}</option>)}
      </select></label>
    <p className="aa-quiet">{t('aa_ex_cond_not_cause')}</p>
    <div className="aa-actions-right"><button type="submit" className="aa-btn aa-btn-ghost" disabled={busy}>{t('aa_ex_save')}</button></div>
  </form>;
}
