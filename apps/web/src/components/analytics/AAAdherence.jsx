import React from 'react';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/*
 * I · Adherence — one cell per window day, in calendar order, exactly as the
 * server classified it. Nothing is filled in here: a future day is not a miss,
 * a day with no record is «не записано» (not «не помню»), and a day after the
 * stop was never run. The denominator is the server's elapsed-day count.
 */
export const ADHERENCE_CLASS = {
  kept: 'is-kept',
  missed: 'is-missed',
  unknown: 'is-unknown',
  not_recorded: 'is-not-recorded',
  future: 'is-future',
  not_run_after_stop: 'is-after-stop',
};

function dayLabel(day, locale) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date))
    .toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function AAAdherence({ adherence, narrow = false }) {
  const t = useAAText();
  const locale = t('_intl_locale');
  if (!adherence?.applicable) {
    return <p className="aa-none">{t('aa_ex_adh_not_applicable')}</p>;
  }
  return <div className="aa-adherence">
    <ol className="aa-adherence-dots" aria-label={t('aa_ex_adh_group')}>
      {adherence.days.map(entry => <li key={entry.day}
        className={`aa-adh ${ADHERENCE_CLASS[entry.state] ?? ''}`}
        data-state={entry.state}
        aria-label={`${dayLabel(entry.day, locale)}: ${t(`aa_ex_adh_${entry.state}`)}${entry.record?.corrected ? ` · ${t('aa_ex_adh_corrected')}` : ''}`}
        title={`${dayLabel(entry.day, locale)} · ${t(`aa_ex_adh_${entry.state}`)}`} />)}
    </ol>
    <p className="aa-quiet">
      {t('aa_ex_adh_summary', adherence.kept, adherence.elapsed_days, adherence.total_days)}
      {adherence.not_run_after_stop > 0 ? ` · ${t('aa_ex_adh_after_stop_count', adherence.not_run_after_stop)}` : ''}
    </p>
    <ul className="aa-adh-legend" aria-hidden="true">
      {['kept', 'missed', 'unknown', 'not_recorded', 'future', 'not_run_after_stop']
        .filter(state => state !== 'not_run_after_stop' || adherence.not_run_after_stop > 0)
        .map(state => <li key={state}><span className={`aa-adh ${ADHERENCE_CLASS[state]}`} />{t(`aa_ex_adh_${state}`)} · {adherence[state]}</li>)}
    </ul>
    {!narrow ? <p className="aa-quiet aa-adh-note">{t('aa_ex_adh_partial_ok')}</p> : null}
  </div>;
}
