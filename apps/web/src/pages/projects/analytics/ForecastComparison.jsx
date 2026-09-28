import React from 'react';
import { deltaDays, formatDateOnly, formatDayDelta, formatInstantDate } from '../../../analytics/projectAnalytics';

/*
 * G · «Срок: прогноз и факт» — two rows in the AA delta grammar.
 *
 * Operands: first surviving estimate · latest forecast (estimate style) · Actual.
 * Deltas: Actual − first, Actual − latest, side by side. The sign is direction
 * only; desirability is shown only when the server names an explicit grounding,
 * which it never does for a project today. No sign-based colour or class.
 */

const GROUNDING_KINDS = ['target', 'preference', 'decision'];

function DateValue({ value, locale }) {
  if (!value) return '—';
  return <time dateTime={value}>{formatDateOnly(value, locale)}</time>;
}

function desireOf(projectDelta) {
  if (projectDelta.delta.state !== 'known') return 'unknown';
  const grounded = projectDelta.grounding_id && GROUNDING_KINDS.includes(projectDelta.grounding_kind);
  return grounded ? projectDelta.desire : 'neutral';
}

const UNKNOWN_COPY = {
  no_facts: ['—', 'aa_pj_sub_no_facts'],
  too_early: ['aa_pr_too_early', 'aa_pj_sub_too_early'],
  actual_not_recorded: ['aa_pj_not_recorded', 'aa_pj_sub_not_recorded'],
  no_forecast: ['—', 'aa_pj_sub_no_forecast'],
  compared: ['—', 'aa_pj_sub_no_facts'],
};

function DeltaCell({ label, projectDelta, reference, state, t, locale }) {
  const days = deltaDays(projectDelta.delta);
  let value;
  let sub;
  if (days == null) {
    const [valueKey, subKey] = UNKNOWN_COPY[state];
    value = valueKey === '—' ? '—' : t(valueKey);
    sub = t(subKey);
  } else {
    value = formatDayDelta(projectDelta.delta, t);
    const date = formatDateOnly(reference?.value?.date, locale);
    sub = t(days > 0 ? 'aa_pj_later_than' : days < 0 ? 'aa_pj_earlier_than' : 'aa_pj_same_as', date);
  }
  return <div className={`aa-delta-cell is-delta${days == null ? ' is-empty' : ''}`} data-desire={desireOf(projectDelta)}>
    <span className="aa-delta-lab">{label}</span>
    <span className="aa-delta-val">{value}</span>
    <span className="aa-delta-sub">{sub}</span>
  </div>;
}

export function ForecastComparison({ data, t, locale }) {
  const { first_forecast: first, latest_forecast: latest, actual, state } = data;
  if (state === 'no_facts') return <p className="aa-none">{t('aa_pj_state_no_facts')}</p>;

  const recorded = fact => t('aa_pj_recorded_on', formatInstantDate(fact.provenance.recorded_at, locale));
  const operands = [
    { key: 'first', label: t('aa_pj_first'), fact: first,
      sub: first ? `${recorded(first)} · ${t('aa_pj_user_forecast')}` : t('aa_pj_forecast_not_set') },
    { key: 'latest', label: t('aa_pj_latest'), fact: latest, estimate: Boolean(latest),
      sub: latest ? `${recorded(latest)} · ${t('aa_pj_user_forecast')}` : t('aa_pj_forecast_not_set') },
    { key: 'actual', label: t('aa_pj_actual'), fact: actual,
      sub: actual
        ? [t('aa_pj_observed_completion'), data.actual_corrections.length ? t('aa_pj_corrected') : null].filter(Boolean).join(' · ')
        : t('aa_pj_actual_absent') },
  ];

  return <div className="aa-pj-compare">
    <div className="aa-delta" role="group" aria-label={t('aa_pj_operands_group')}>
      {operands.map(cell => <div key={cell.key} data-operand={cell.key}
        className={`aa-delta-cell${cell.estimate ? ' is-estimate' : ''}${cell.fact ? '' : ' is-empty'}`}>
        <span className="aa-delta-lab">{cell.label}</span>
        <span className="aa-delta-val"><DateValue value={cell.fact?.value?.date} locale={locale} /></span>
        <span className="aa-delta-sub">{cell.sub}</span>
      </div>)}
    </div>
    <div className="aa-delta is-pair" role="group" aria-label={t('aa_pj_deltas_group')}>
      <DeltaCell label={t('aa_pj_vs_first')} projectDelta={data.delta_vs_first} reference={first} state={state} t={t} locale={locale} />
      <DeltaCell label={t('aa_pj_vs_latest')} projectDelta={data.delta_vs_latest} reference={latest} state={state} t={t} locale={locale} />
    </div>
    {data.forecast_version_count === 1 ? <p className="aa-note">{t('aa_pj_single_version')}</p> : null}
    {state === 'compared' ? <p className="aa-note">{t('aa_pj_neutral_note')}</p> : null}
  </div>;
}
