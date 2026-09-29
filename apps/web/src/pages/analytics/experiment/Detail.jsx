/* Experiment · detail (frozen I, minus every demo value). Everything shown is
   server truth; queued writes are counted beside it, never merged into it. The
   lifecycle drives the stages and the actions; the decision never does. */

import React from 'react';
import AAAdherence from '../../../components/analytics/AAAdherence.jsx';
import AADelta from '../../../components/analytics/AADelta.jsx';
import AAExpStages from '../../../components/analytics/AAExpStages.jsx';
import AAFactorTag from '../../../components/analytics/AAFactorTag.jsx';
import AAFacts from '../../../components/analytics/AAFacts.jsx';
import AAProvenance from '../../../components/analytics/AAProvenance.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { PageHeader } from '../../../components/HeroVignette.jsx';
import { formatValue } from '../../../analytics/values';
import { DecisionStep } from './DecisionStep.jsx';
import { AdherenceForm, BaselineForm, ConditionForm, ObservationForm } from './EvidenceForms.jsx';
import { daysText, dateText, focusStep, historyRows, instantText, statusText, windowText } from './format.js';

const EVIDENCE = ['RUNNING', 'COMPLETED_AWAITING_REVIEW'];
const DECIDING = ['COMPLETED_AWAITING_REVIEW', 'REVIEWED'];
const STOPPABLE = ['DRAFT', 'RUNNING']; // D4: the UI offers a stop only before the period ends

const back = t => <nav className="aa-pj-nav" aria-label={t('aa_ex_nav_group')}>
  <a className="aa-link" href="#/experiment">{t('aa_ex_back')}</a>
</nav>;

/** Confirm dialog: focus moves in, Tab stays inside, Escape cancels, focus returns. */
export function StopDialog({ onConfirm, onCancel, opener }) {
  const t = useAAText();
  const dialog = React.useRef(null);
  React.useEffect(() => {
    dialog.current?.querySelector('button')?.focus();
    const returnTo = opener?.current;
    return () => returnTo?.focus?.();
  }, [opener]);
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.current.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    const next = focusStep(index, buttons.length, event.shiftKey);
    event.preventDefault();
    buttons[next]?.focus();
  }
  return <div className="aa-exp-scrim">
    <div className="aa-exp-dialog" role="dialog" aria-modal="true" aria-labelledby="exp-stop-title"
      aria-describedby="exp-stop-body" ref={dialog} onKeyDown={onKeyDown}>
      <h3 className="panel-title" id="exp-stop-title">{t('aa_ex_stop_title')}</h3>
      <p className="aa-quiet" id="exp-stop-body">{t('aa_ex_stop_body')}</p>
      <div className="aa-actions-right">
        <button type="button" className="aa-btn aa-btn-ghost" onClick={onCancel}>{t('aa_ex_cancel')}</button>
        <button type="button" className="aa-btn aa-btn-primary" onClick={onConfirm}>{t('aa_ex_stop_confirm')}</button>
      </div>
    </div>
  </div>;
}

function PendingNote({ records, t, onDiscard, onExport }) {
  const failed = records.filter(record => record.state === 'failed_permanent' || record.state === 'terminal_conflict');
  const waiting = records.length - failed.length;
  return <>
    {waiting > 0 ? <p className="aa-note aa-exp-pending" role="status">{t('aa_ex_pending', waiting)}</p> : null}
    {failed.length
      ? <section className="card panel aa-section" aria-labelledby="exp-failed">
        <h3 className="panel-title" id="exp-failed">{t('aa_ex_failed_title', failed.length)}</h3>
        <p className="aa-note">{t('aa_ex_failed_hint')}</p>
        <ul className="aa-exp-items">{failed.map(record => <li key={record.queue_id} className="aa-exp-failed">
          <span>{t(`aa_ex_op_${record.operation_type.split('.')[1]}`)} · {record.last_error_code ?? record.state}</span>
          <span className="aa-actions-right">
            <button type="button" className="aa-btn aa-btn-ghost" onClick={() => onExport(record.queue_id)}>{t('aa_ex_failed_export')}</button>
            <button type="button" className="aa-btn aa-btn-ghost" onClick={() => onDiscard(record.queue_id)}>{t('aa_ex_failed_discard')}</button>
          </span>
        </li>)}</ul>
      </section>
      : null}
  </>;
}

function Result({ detail, t, narrow }) {
  const { result, window: period } = detail;
  if (result.state === 'not_applicable') {
    return <p className="aa-none">{t(detail.lifecycle === 'DRAFT' ? 'aa_ex_result_after_period' : 'aa_ex_result_stopped')}</p>;
  }
  const covered = result.outcome_day
    ? t('aa_ex_result_as_of', dateText(result.outcome_day, t), result.covered_days, period.total_days)
    : null;
  const notes = {
    reference: { label: t('aa_ex_baseline_label'), extra: t('aa_ex_before_intervention') },
    current: { label: t(result.state === 'too_early' ? 'aa_ex_so_far' : 'aa_ex_for_period'), ...(covered ? { extra: covered } : {}) },
    ...(result.state === 'too_early'
      ? { delta: { value: t('aa_ex_too_early'), sub: t('aa_ex_period_not_finished') } }
      : {}),
  };
  return <>
    <AADelta summary={result.summary} comparison={result.comparison} notes={notes} narrow={narrow} />
    {result.state === 'too_early' ? <p className="aa-note">{t('aa_ex_interim_note')}</p> : null}
    {result.state === 'no_data' ? <p className="aa-note">{t('aa_ex_result_no_data')}</p> : null}
    <p className="aa-exp-warn">{t('aa_ex_not_proof')}</p>
  </>;
}

function Observations({ detail, t, narrow }) {
  const rows = [...detail.observations.outcome, ...detail.observations.context]
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  if (!rows.length) return <p className="aa-none">{t('aa_ex_obs_empty')}</p>;
  return <ul className="aa-exp-obs">{rows.map(row => <li className="aa-tradeoff" key={row.id}>
    <span>{row.label} <span className="aa-quiet">· {t(`aa_ex_obs_role_${row.role}`)} · {instantText(row.occurred_at, t)}</span></span>
    <span className="aa-exp-obs-v"><span className="aa-tradeoff-v">{formatValue(row.value, t)}</span>
      <AAProvenance provenance={row.provenance} narrow={narrow} /></span>
  </li>)}</ul>;
}

function Conditions({ detail, t }) {
  const { adherence } = detail;
  return <div className="aa-quality aa-exp-quality" role="group" aria-label={t('aa_ex_quality_group')}>
    {adherence.applicable
      ? <span className="aa-quality-item">{t('aa_ex_q_kept')} <b>{adherence.kept} / {adherence.elapsed_days}</b></span>
      : null}
    {adherence.applicable
      ? <span className="aa-quality-item">{t('aa_ex_q_elapsed')} <b>{adherence.elapsed_days} / {adherence.total_days}</b></span>
      : null}
    <span className="aa-quality-item">{t('aa_ex_q_conditions')} <b>{detail.conditions.length}</b></span>
    <span className="aa-quality-item">{t('aa_ex_q_cause')} <b>{t('aa_ex_q_cause_unknown')}</b></span>
    <div className="aa-quality-detail aa-exp-conditions">
      {detail.conditions.length
        ? detail.conditions.map(condition => <div className="aa-tradeoff" key={condition.id}>
          <span>{condition.value?.text}</span>
          <AAFactorTag kind={condition.epistemic_kind ?? 'unknown'} readOnly />
        </div>)
        : <p className="aa-none">{t('aa_ex_no_conditions')}</p>}
    </div>
  </div>;
}

export function ExperimentDetailView({
  detail, records = [], narrow = false, busy = false, actions = {},
}) {
  const t = useAAText();
  const stopButton = React.useRef(null);
  const [confirming, setConfirming] = React.useState(false);
  const pendingKeyFor = day => {
    const matches = records.filter(record => record.operation_type === 'experiment.adherence' && record.payload?.day === day);
    return matches.length ? matches[matches.length - 1].idempotency_key : null;
  };
  const { lifecycle } = detail;
  const facts = [
    { id: 'baseline', label: t('aa_ex_baseline_label'), value: detail.baseline?.value ?? null,
      note: detail.baseline ? windowText(detail.baseline.window_start, detail.baseline.window_end, t) : t('aa_ex_baseline_none') },
    { id: 'intervention', label: t('aa_ex_intervention_label'), statement: detail.intervention },
    { id: 'period', label: t('aa_ex_period_label'), statement: daysText(detail.window.total_days, t),
      note: windowText(detail.window.start, detail.window.end, t) },
  ];
  const history = historyRows(detail, t);

  return <div className={`page experiment-page${narrow ? ' aa-narrow' : ''}`}>
    <PageHeader title={detail.title} subtitle={`${t('aa_ex_eyebrow')} · ${statusText(detail, t)}`} aside={back(t)} />
    <PendingNote records={records} t={t} onDiscard={actions.discard} onExport={actions.exportFailure} />

    <section className="card panel aa-section" aria-label={t('aa_ex_claim_group')}>
      <AAExpStages lifecycle={lifecycle} abandonedFrom={detail.abandoned_from} />
      <div className="aa-exp-claim">
        <div className="aa-exp-claim-lab">{t('aa_ex_claim_label')}</div>
        <p className="aa-exp-claim-text">«{detail.hypothesis}»</p>
        <p className="aa-quiet">{t('aa_ex_claim_when', instantText(detail.hypothesis_recorded_at, t))}</p>
      </div>
      <div className="aa-exp-facts"><AAFacts facts={facts} narrow={narrow} /></div>
      {lifecycle === 'DRAFT' || STOPPABLE.includes(lifecycle)
        ? <div className="aa-actions">
          {lifecycle === 'DRAFT'
            ? <button type="button" className="aa-btn aa-btn-primary" disabled={busy} onClick={actions.start}>{t('aa_ex_start')}</button>
            : <span />}
          <button type="button" ref={stopButton} className="aa-btn aa-btn-ghost" disabled={busy}
            onClick={() => setConfirming(true)}>{t('aa_ex_stop')}</button>
        </div>
        : null}
    </section>

    <section className="card panel aa-section" aria-labelledby="exp-adh">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-adh">{t('aa_ex_adh_title')}</h3>
      </div>
      <AAAdherence adherence={detail.adherence} narrow={narrow} />
      <Conditions detail={detail} t={t} />
      <p className="aa-exp-warn">{t('aa_ex_quality_note')}</p>
      {EVIDENCE.includes(lifecycle)
        ? <div className="aa-exp-forms">
          <AdherenceForm detail={detail} pendingKeyFor={pendingKeyFor} onRecord={actions.recordAdherence} busy={busy} />
          <ConditionForm onRecord={actions.recordCondition} busy={busy} />
        </div>
        : null}
    </section>

    <section className="card panel aa-section" aria-labelledby="exp-obs">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-obs">{t('aa_ex_obs_title')}</h3>
        <span className="aa-quiet">{t('aa_ex_obs_sub')}</span>
      </div>
      <Observations detail={detail} t={t} narrow={narrow} />
      <div className="aa-exp-forms">
        {EVIDENCE.includes(lifecycle) ? <ObservationForm detail={detail} onRecord={actions.recordObservation} busy={busy} /> : null}
        {lifecycle === 'DRAFT' || lifecycle === 'RUNNING'
          ? <BaselineForm detail={detail} onRecord={actions.recordBaseline} busy={busy} /> : null}
      </div>
    </section>

    <section className="card panel aa-section" aria-labelledby="exp-result">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-result">{t('aa_ex_result_title')}</h3>
      </div>
      <Result detail={detail} t={t} narrow={narrow} />
    </section>

    {DECIDING.includes(lifecycle)
      ? <DecisionStep key={detail.decision.history.length} decision={detail.decision} onSave={actions.saveDecision} busy={busy} />
      : null}

    <section className="card panel aa-section" aria-labelledby="exp-history">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-history">{t('aa_ex_history_title')}</h3>
        <span className="aa-quiet">{t('aa_ex_history_sub')}</span>
      </div>
      <ol className="aa-hist" aria-labelledby="exp-history">{history.map(row => <li className="aa-hist-row" key={row.key}>
        <time className="aa-hist-when" dateTime={row.when}>{instantText(row.when, t)}</time>
        <div className="aa-hist-what">{row.what}</div>
        <span />
      </li>)}</ol>
    </section>

    {confirming
      ? <StopDialog opener={stopButton} onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); actions.stop?.(); }} />
      : null}
  </div>;
}

/** A create still in the queue: shown from the queued record, marked unsaved. */
export function UnsavedExperimentView({ record, records = [], actions = {} }) {
  const t = useAAText();
  const payload = record.payload;
  return <div className="page experiment-page">
    <PageHeader title={payload.title} subtitle={`${t('aa_ex_eyebrow')} · ${t('aa_ex_not_saved_yet')}`} aside={back(t)} />
    <PendingNote records={records} t={t} onDiscard={actions.discard} onExport={actions.exportFailure} />
    <section className="card panel aa-section">
      <div className="aa-exp-claim">
        <div className="aa-exp-claim-lab">{t('aa_ex_claim_label')}</div>
        <p className="aa-exp-claim-text">«{payload.hypothesis}»</p>
      </div>
      <p className="aa-note" role="status">{t('aa_ex_unsaved_body')}</p>
    </section>
  </div>;
}

export function NotFoundView() {
  const t = useAAText();
  return <div className="page experiment-page">
    <PageHeader title={t('aa_ex_title')} aside={back(t)} />
    <section className="card panel aa-section"><p className="aa-none">{t('aa_ex_not_found')}</p></section>
  </div>;
}
