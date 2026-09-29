import React from 'react';
import {
  canMintExperimentId,
  completionDue,
  experimentAdherenceRequest,
  experimentBaselineRequest,
  experimentConditionRequest,
  experimentCreateRequest,
  decisionSaveRequests,
  experimentHash,
  experimentObservationRequest,
  experimentTransitionRequest,
  newExperimentId,
  outcomeValue,
  parseExperimentHash,
} from '../../analytics/experimentFacts';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { AnalyticsContext } from '../../context/AnalyticsContext.jsx';
import { CreateForm } from './experiment/CreateForm.jsx';
import { ExperimentDetailView, NotFoundView, UnsavedExperimentView } from './experiment/Detail.jsx';
import { ExperimentListView } from './experiment/ExperimentList.jsx';
import '../../analytics.css';

/*
 * I · Experiment — list · create · detail over the durable queue.
 *
 * Every action is an ordered queue record (FIFO, single-flight): create →
 * baseline → start, or decision → REVIEWED. If one is refused, the head of the
 * queue blocks every later record, so nothing after it is ever sent silently.
 * The page shows the server's state and a neutral count of unconfirmed
 * records — never an optimistic guess. A read never completes an experiment;
 * the page enqueues «period over» itself once, and a duplicate is a server no-op.
 */

export { ExperimentDetailView } from './experiment/Detail.jsx';
export { ExperimentListView } from './experiment/ExperimentList.jsx';

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
const now = () => new Date().toISOString();

function ListPage({ analytics }) {
  const t = useAAText();
  const [result, setResult] = React.useState({ data: null, error: null });
  const [queued, setQueued] = React.useState([]);
  const ready = Boolean(analytics?.ready);
  const sync = analytics?.sync;
  React.useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    analytics.pendingExperimentWrites(null).then(rows => { if (live) setQueued(rows); }).catch(() => {});
    return () => { live = false; };
  }, [ready, sync]);
  React.useEffect(() => {
    if (!ready) return undefined;
    const controller = new window.AbortController();
    analytics.listExperiments({ limit: 50 }, controller.signal)
      .then(data => setResult({ data, error: null }))
      .catch(error => { if (error?.name !== 'AbortError') setResult({ data: null, error }); });
    return () => controller.abort();
  }, [ready, queued.length]);
  return <div className="page experiment-page">
    <PageHeader title={t('aa_ex_title')} subtitle={t('aa_ex_subtitle')} />
    <ExperimentListView data={result.data} error={result.error} queued={queued} canCreate={canMintExperimentId()} />
  </div>;
}

function NewPage({ analytics }) {
  const t = useAAText();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  async function create(values) {
    setBusy(true);
    setError(null);
    try {
      const id = newExperimentId();
      await analytics.enqueueExperiment(experimentCreateRequest({
        id,
        title: values.title,
        hypothesis: values.hypothesis,
        hypothesisRecordedAt: now(),
        intervention: values.intervention,
        windowStart: values.windowStart,
        windowEnd: values.windowEnd,
        outcome: values.outcome,
      }));
      if (values.baselineValue.trim()) {
        await analytics.enqueueExperiment(experimentBaselineRequest(id, {
          value: outcomeValue(values.outcome, values.baselineValue),
          windowStart: values.baselineStart,
          windowEnd: values.baselineEnd,
        }));
      }
      if (values.startNow) await analytics.enqueueExperiment(experimentTransitionRequest(id, 'RUNNING', now()));
      window.location.hash = experimentHash(id);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }
  return <div className="page experiment-page">
    <PageHeader title={t('aa_ex_new')} subtitle={t('aa_ex_eyebrow')} />
    {error ? <p className="aa-none" role="alert">{t('aa_ex_enqueue_failed')}</p> : null}
    <CreateForm onCreate={create} canCreate={canMintExperimentId()} busy={busy} />
  </div>;
}

function DetailPage({ analytics, id }) {
  const narrow = useNarrow();
  const [result, setResult] = React.useState({ data: null, error: null });
  const [records, setRecords] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const ready = Boolean(analytics?.ready);
  const sync = analytics?.sync;
  const completionAsked = React.useRef(false);

  const refreshQueue = React.useCallback(() => analytics.pendingExperimentWrites(id)
    .then(rows => { setRecords(rows); return rows; })
    .catch(() => []), [analytics, id]);

  /* Re-count this experiment's unacknowledged records whenever the queue reports. */
  React.useEffect(() => {
    if (!ready) return;
    void refreshQueue();
  }, [ready, sync, id]);

  /* Server truth, re-read when the unconfirmed count changes (i.e. after a drain). */
  React.useEffect(() => {
    if (!ready) return undefined;
    const controller = new window.AbortController();
    analytics.readExperiment(id, controller.signal)
      .then(data => setResult({ data, error: null }))
      /* Offline, a failed re-read keeps the last acknowledged state on screen
         (with the unconfirmed-records note) instead of blanking it. */
      .catch(error => { if (error?.name !== 'AbortError') setResult(previous => ({ data: previous.data, error })); });
    return () => controller.abort();
  }, [ready, id, records.length]);

  /* «Period over»: once, only while RUNNING and nothing is queued for it yet. */
  React.useEffect(() => {
    const detail = result.data;
    if (!detail || completionAsked.current || !completionDue(detail, records)) return;
    completionAsked.current = true;
    void analytics.enqueueExperiment(experimentTransitionRequest(id, 'COMPLETED_AWAITING_REVIEW', now()))
      .then(refreshQueue);
  }, [result.data, records]);

  async function run(requests) {
    setBusy(true);
    try {
      for (const request of requests) await analytics.enqueueExperiment(request);
    } finally {
      setBusy(false);
      await refreshQueue();
    }
  }

  const actions = {
    start: () => run([experimentTransitionRequest(id, 'RUNNING', now())]),
    stop: () => run([experimentTransitionRequest(id, 'ABANDONED', now())]),
    recordAdherence: (day, state, supersedes) => run([experimentAdherenceRequest(id, day, state, supersedes)]),
    recordObservation: input => run([experimentObservationRequest(id, { ...input, occurredAt: now() })]),
    recordBaseline: input => run([experimentBaselineRequest(id, input)]),
    recordCondition: input => run([experimentConditionRequest(id, { ...input, occurredAt: now() })]),
    /* Decision first, then REVIEWED: if the decision is refused, the blocked
       head keeps REVIEWED from ever being sent. */
    saveDecision: input => run(decisionSaveRequests(id, result.data?.lifecycle, now(), input)),
    discard: async queueId => { await analytics.discardQueueFailure(queueId); await refreshQueue(); },
    exportFailure: async queueId => {
      const text = await analytics.exportQueueFailure(queueId);
      const url = window.URL.createObjectURL(new window.Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `lifeos-analytics-queue-${queueId}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
  };

  if (result.data) {
    return <ExperimentDetailView detail={result.data} records={records} narrow={narrow} busy={busy} actions={actions} />;
  }
  const queuedCreate = records.find(record => record.operation_type === 'experiment.create');
  if (queuedCreate) return <UnsavedExperimentView record={queuedCreate} records={records} actions={actions} />;
  if (result.error?.status === 404) return <NotFoundView />;
  return <div className="page experiment-page" aria-busy={!result.error}>
    <PageHeader title="" />
    <DetailFallback error={result.error} />
  </div>;
}

function DetailFallback({ error }) {
  const t = useAAText();
  return <section className="card panel">
    {error ? <p className="aa-none" role="alert">{t('aa_ex_unavailable')}</p> : <p className="aa-note">{t('aa_ex_loading')}</p>}
  </section>;
}

export default function ExperimentPage() {
  const analytics = React.useContext(AnalyticsContext);
  const t = useAAText();
  const [view, setView] = React.useState(() => parseExperimentHash(readHash()) ?? { view: 'list' });

  React.useEffect(() => {
    const onHash = () => setView(parseExperimentHash(readHash()) ?? { view: 'list' });
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!analytics || analytics.enabled === false) {
    return <div className="page experiment-page">
      <PageHeader title={t('aa_ex_title')} />
      <section className="card panel"><p className="aa-none">{t('aa_ex_disabled')}</p></section>
    </div>;
  }
  if (view.view === 'new') return <NewPage analytics={analytics} />;
  if (view.view === 'detail') return <DetailPage key={view.id} analytics={analytics} id={view.id} />;
  return <ListPage analytics={analytics} />;
}
