import React from 'react';
import {
  importanceRequest,
  parseSystemReviewHash,
  proposalResponseRequest,
} from '../../analytics/systemReviewFacts';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { AnalyticsContext } from '../../context/AnalyticsContext.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { buildLookup, mergeLookups, periodTitle } from './system/format.js';
import { ReviewView } from './system/ReviewView.jsx';
import { RevisionView } from './system/RevisionView.jsx';
import { WaitingView } from './system/Waiting.jsx';
import '../../analytics.css';

/*
 * J · System Review — live (derived on every read, writes nothing) and saved
 * (append-only revisions). One read model powers the review, the trade-off
 * view (J1) and the waiting list; every user action is one durable queue
 * record. The page shows server truth plus a neutral note about records the
 * server has not acknowledged yet — never an optimistic count.
 */

export { ReviewView } from './system/ReviewView.jsx';

function useNarrow() {
  const query = '(max-width: 700px)';
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

const readHash = () => (typeof window === 'undefined' ? '' : window.location.hash);

/** Unacknowledged Slice 7 records, indexed the way the views ask for them. */
export function pendingIndex(records) {
  const index = {
    importance: {}, responses: {}, links: [], feedback: {}, deletes: new Set(), contexts: [],
    contextDeletes: new Set(), revisions: {}, failures: [], count: 0,
  };
  for (const record of records) {
    index.count += 1;
    if (record.state === 'failed_permanent' || record.state === 'terminal_conflict') {
      index.failures.push(record);
    }
    const payload = record.payload ?? {};
    const id = record.route.split('/')[5];
    switch (record.operation_type) {
      case 'importance.set': index.importance[payload.target_key] = payload.importance; break;
      case 'relation.respond': index.responses[payload.proposal_key] = payload.response; break;
      case 'relation.create': index.links.push(payload); break;
      case 'relation.feedback': index.feedback[id] = payload.response; break;
      case 'relation.delete': index.deletes.add(id); break;
      case 'finance_context.append': index.contexts.push(payload); break;
      case 'finance_context.delete': index.contextDeletes.add(id); break;
      case 'system_review.revision': index.revisions[record.route.split('/')[5]] = payload; break;
      default: break;
    }
  }
  return index;
}

function useQueue(analytics) {
  const [records, setRecords] = React.useState([]);
  const ready = Boolean(analytics?.ready);
  const sync = analytics?.sync;
  const refresh = React.useCallback(
    () => analytics.pendingSystemReviewWrites().then(rows => { setRecords(rows); return rows; }).catch(() => []),
    [analytics],
  );
  React.useEffect(() => {
    if (ready) void refresh();
  }, [ready, sync]);
  return [records, refresh];
}

function ActionsProvider({ analytics, refreshQueue, children }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const actions = React.useMemo(() => {
    async function enqueue(requests) {
      setBusy(true);
      setError(null);
      try {
        for (const request of [].concat(requests)) await analytics.enqueueSystemReview(request);
      } catch (caught) {
        setError(caught);
      } finally {
        setBusy(false);
        await refreshQueue();
      }
    }
    return {
      busy,
      error,
      enqueue,
      setImportance: (ref, value) => enqueue(importanceRequest(ref, value)),
      respond: (candidate, response, note, evaluatedAt) =>
        enqueue(proposalResponseRequest(candidate, response, evaluatedAt, note)),
      discard: async queueId => {
        await analytics.discardQueueFailure(queueId);
        await refreshQueue();
      },
    };
  }, [analytics, busy, error, refreshQueue]);
  return children(actions);
}

function ReviewPage({ analytics, view, narrow }) {
  const t = useAAText();
  const life = React.useContext(LifeDataContext)?.state;
  const [records, refreshQueue] = useQueue(analytics);
  const [result, setResult] = React.useState({ data: null, error: null });
  const [waiting, setWaiting] = React.useState(null);
  const ready = Boolean(analytics?.ready);
  const period = view.period;

  React.useEffect(() => {
    if (!ready) return undefined;
    const controller = new window.AbortController();
    analytics.readSystemReview(period, controller.signal)
      .then(data => setResult({ data, error: null }))
      .catch(error => {
        if (error?.name !== 'AbortError') setResult(previous => ({ data: previous.data?.period === period ? previous.data : null, error }));
      });
    analytics.readSystemReviewWaiting(controller.signal).then(setWaiting).catch(() => {});
    return () => controller.abort();
  }, [ready, period, records.length]);

  const pending = React.useMemo(() => pendingIndex(records), [records]);
  const names = React.useMemo(() => buildLookup(result.data, life), [result.data, life]);
  const title = t('aa_sr_title_period', periodTitle(period, t));
  return <div className="page system-review-page">
    <PageHeader title={title} subtitle={t('aa_sr_subtitle')} />
    <ActionsProvider analytics={analytics} refreshQueue={refreshQueue}>
      {actions => <ReviewView review={result.data} error={result.error} period={period} tab={view.tab}
        waiting={waiting} names={names} life={life} pending={pending} actions={actions}
        narrow={narrow} analytics={analytics} />}
    </ActionsProvider>
  </div>;
}

function RevisionPage({ analytics, view, narrow }) {
  const t = useAAText();
  const life = React.useContext(LifeDataContext)?.state;
  const [result, setResult] = React.useState({ data: null, error: null });
  React.useEffect(() => {
    if (!analytics?.ready) return undefined;
    const controller = new window.AbortController();
    analytics.readRevision(view.period, view.revision, true, controller.signal)
      .then(data => setResult({ data, error: null }))
      .catch(error => { if (error?.name !== 'AbortError') setResult({ data: null, error }); });
    return () => controller.abort();
  }, [analytics?.ready, view.period, view.revision]);
  return <div className="page system-review-page">
    <PageHeader title={t('aa_sr_revision_title', periodTitle(view.period, t), view.revision)}
      subtitle={t('aa_sr_revision_subtitle')} />
    <RevisionView revision={result.data} error={result.error} period={view.period}
      number={view.revision} life={life} narrow={narrow} />
  </div>;
}

function WaitingPage({ analytics }) {
  const t = useAAText();
  const life = React.useContext(LifeDataContext)?.state;
  const [reviews, setReviews] = React.useState([]);
  const names = React.useMemo(
    () => mergeLookups([buildLookup(null, life), ...reviews.map(review => buildLookup(review, life))]),
    [life, reviews],
  );
  const [records, refreshQueue] = useQueue(analytics);
  const [result, setResult] = React.useState({ data: null, error: null });
  React.useEffect(() => {
    if (!analytics?.ready) return undefined;
    const controller = new window.AbortController();
    analytics.readSystemReviewWaiting(controller.signal)
      .then(data => {
        setResult({ data, error: null });
        /* Name the proposals' items: read (never write) the reviews they come from. */
        const periods = [...new Set(data.requires_confirmation.items.map(item => item.period))];
        return Promise.all(periods.map(period => analytics.readSystemReview(period, controller.signal)));
      })
      .then(loaded => { if (loaded) setReviews(loaded); })
      .catch(error => { if (error?.name !== 'AbortError') setResult(previous => ({ data: previous.data, error })); });
    return () => controller.abort();
  }, [analytics?.ready, records.length]);
  const pending = React.useMemo(() => pendingIndex(records), [records]);
  return <div className="page system-review-page">
    <PageHeader title={t('aa_sr_waiting_title')} subtitle={t('aa_sr_waiting_subtitle')} />
    <ActionsProvider analytics={analytics} refreshQueue={refreshQueue}>
      {actions => <WaitingView waiting={result.data} error={result.error} pending={pending}
        actions={actions} names={names} />}
    </ActionsProvider>
  </div>;
}

export default function SystemReviewPage() {
  const analytics = React.useContext(AnalyticsContext);
  const t = useAAText();
  const narrow = useNarrow();
  const [view, setView] = React.useState(() => parseSystemReviewHash(readHash()) ?? parseSystemReviewHash('#/system-review'));

  React.useEffect(() => {
    const onHash = () => setView(parseSystemReviewHash(readHash()) ?? parseSystemReviewHash('#/system-review'));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!analytics || analytics.enabled === false) {
    return <div className="page system-review-page">
      <PageHeader title={t('aa_sr_title')} />
      <section className="card panel"><p className="aa-none">{t('aa_sr_disabled')}</p></section>
    </div>;
  }
  if (view.view === 'waiting') return <WaitingPage analytics={analytics} />;
  if (view.view === 'revision') return <RevisionPage key={`${view.period}-${view.revision}`} analytics={analytics} view={view} narrow={narrow} />;
  return <ReviewPage key={view.period} analytics={analytics} view={view} narrow={narrow} />;
}
