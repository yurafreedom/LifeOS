/* System Review · the live review for one month or year (J2), with the
   trade-off tab (J1). A pure view over the server's read model plus the list
   of unacknowledged queue records; it never computes analytics itself. */

import React from 'react';
import {
  currentMonthKey,
  isYear,
  periodStarted,
  shiftPeriod,
  systemReviewHash,
  waitingHash,
} from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { ConsequencesSection } from './Consequences.jsx';
import { dateText, periodTitle } from './format.js';
import { LinkDialog } from './LinkDialog.jsx';
import { ProposalsSection, RelationsSection } from './Relations.jsx';
import { SavedReviewSection } from './SavedReview.jsx';
import {
  ChangedSection,
  ImprovedSection,
  QualitySection,
  RepeatedSection,
  TradeoffsSection,
} from './Sections.jsx';
import { TradeoffView } from './Tradeoff.jsx';

function Toolbar({ review, period, tab, waiting }) {
  const t = useAAText();
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const year = isYear(period);
  const current = currentMonthKey();
  const toggle = year ? (period === current.slice(0, 4) ? current : `${period}-12`) : period.slice(0, 4);
  return <nav className="aa-sr-toolbar" aria-label={t('aa_sr_period_nav')}>
    <div className="aa-sr-period">
      <a className="aa-link" href={systemReviewHash(previous, tab)} aria-label={t('aa_sr_prev_period')}>‹ {periodTitle(previous, t)}</a>
      <span className="aa-sr-period-now" aria-current="page">{periodTitle(period, t)}</span>
      {periodStarted(next)
        ? <a className="aa-link" href={systemReviewHash(next, tab)} aria-label={t('aa_sr_next_period')}>{periodTitle(next, t)} ›</a>
        : <span className="aa-quiet">{t('aa_sr_no_future')}</span>}
    </div>
    <div className="aa-sr-tabs" role="group" aria-label={t('aa_sr_view')}>
      <a className={`aa-tag${!year ? ' is-on' : ''}`} href={systemReviewHash(year ? toggle : period)} aria-current={!year ? 'true' : undefined}>{t('aa_sr_month')}</a>
      <a className={`aa-tag${year ? ' is-on' : ''}`} href={systemReviewHash(year ? period : toggle)} aria-current={year ? 'true' : undefined}>{t('aa_sr_year')}</a>
      {!year ? <>
        <a className={`aa-tag${tab === 'review' ? ' is-on' : ''}`} href={systemReviewHash(period)} aria-current={tab === 'review' ? 'true' : undefined}>{t('aa_sr_tab_review')}</a>
        <a className={`aa-tag${tab === 'tradeoff' ? ' is-on' : ''}`} href={systemReviewHash(period, 'tradeoff')} aria-current={tab === 'tradeoff' ? 'true' : undefined}>{t('aa_sr_tab_tradeoff')}</a>
      </> : null}
    </div>
    <div className="aa-sr-counts">
      {review ? <span className="aa-tag" data-kind={review.status === 'FINALIZED' ? 'observed' : 'unknown'}>{t(`aa_sr_status_${review.status}`)}</span> : null}
      {waiting ? <>
        <a className="aa-link" href={waitingHash()}>{t('aa_sr_review_available', waiting.review_available.count)}</a>
        <a className="aa-link" href={waitingHash()}>{t('aa_sr_requires', waiting.requires_confirmation.count)}</a>
      </> : null}
    </div>
  </nav>;
}

function QueueNote({ pending, actions }) {
  const t = useAAText();
  if (!pending.count && !actions.error) return null;
  return <div className="aa-sr-queue" role="status">
    {pending.count > pending.failures.length ? <span className="aa-quiet">{t('aa_sr_unconfirmed', pending.count - pending.failures.length)}</span> : null}
    {pending.failures.map(record => <span key={record.queue_id} className="aa-exp-failed">
      <span>{t('aa_sr_refused', t(`aa_sr_op_${record.operation_type.replace('.', '_')}`), record.last_error_code ?? '')}</span>
      <button type="button" className="aa-link" onClick={() => actions.discard(record.queue_id)}>{t('aa_sr_discard')}</button>
    </span>)}
    {actions.error ? <span className="aa-exp-error" role="alert">{t('aa_sr_enqueue_failed')}</span> : null}
  </div>;
}

export function ReviewView({ review, error, period, tab, waiting, names, life, pending, actions, narrow, analytics }) {
  const t = useAAText();
  const [linkFrom, setLinkFrom] = React.useState(null);
  if (!review) {
    return <div className={`aa-sr${narrow ? ' aa-narrow' : ''}`}>
      <Toolbar review={null} period={period} tab={tab} waiting={waiting} />
      <section className="card panel" aria-busy={!error}>
        {error ? <p className="aa-none" role="alert">{t(error.code === 'period_in_future' ? 'aa_sr_future' : 'aa_sr_unavailable')}</p>
          : <p className="aa-note">{t('aa_sr_loading')}</p>}
      </section>
    </div>;
  }
  const onLink = ref => setLinkFrom(ref);
  return <div className={`aa-sr${narrow ? ' aa-narrow' : ''}`}>
    <Toolbar review={review} period={period} tab={tab} waiting={waiting} />
    <QueueNote pending={pending} actions={actions} />
    {error ? <p className="aa-quiet" role="status">{t('aa_sr_stale')}</p> : null}
    {tab === 'tradeoff' && review.period_kind === 'month'
      ? <TradeoffView review={review} names={names} pending={pending} actions={actions} onLink={onLink} />
      : <>
        <div className="aa-banner" role="note"><b>{t('aa_sr_not_verdict_title')}</b> {t('aa_sr_banner')}</div>
        {review.retention?.truncated ? <p className="aa-retention-note" role="note">
          {t('aa_sr_retention_truncated', dateText(review.retention.horizon, t),
            review.retention.truncated_months.map(key => periodTitle(key, t)).join(', '))}
        </p> : null}
        <ChangedSection review={review} names={names} pending={pending} actions={actions} onLink={onLink} />
        <ImprovedSection review={review} names={names} />
        <RepeatedSection review={review} names={names} />
        <TradeoffsSection review={review} names={names} />
        <ConsequencesSection review={review} names={names} life={life} pending={pending} actions={actions} />
        <RelationsSection review={review} names={names} pending={pending} actions={actions} />
        <ProposalsSection review={review} names={names} pending={pending} actions={actions} />
        <QualitySection review={review} />
        <SavedReviewSection review={review} pending={pending} actions={actions} analytics={analytics} />
        <p className="aa-warn-note">{t('aa_sr_relation_to_rest')}</p>
      </>}
    {linkFrom ? <LinkDialog from={linkFrom} review={review} names={names} busy={actions.busy}
      onClose={() => setLinkFrom(null)}
      onSave={request => { actions.enqueue(request); setLinkFrom(null); }} /> : null}
  </div>;
}
