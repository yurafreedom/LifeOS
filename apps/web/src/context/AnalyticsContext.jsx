import React from 'react';
import { financeTransactionMeasurementPayload } from '../analytics/financeTransaction.ts';
import {
  projectCompletionQueueRequest,
  projectForecastQueueRequest,
} from '../analytics/projectFacts.ts';
import { countPendingProjectWrites } from '../analytics/projectAnalytics.ts';
import { pendingCreates, pendingExperimentRecords } from '../analytics/experimentQueue.ts';
import { AnalyticsRepository } from '../repositories/analyticsRepository.ts';
import { AnalyticsSyncCoordinator } from '../repositories/analyticsSyncCoordinator.ts';
import { AnalyticsWriteQueue } from '../repositories/analyticsWriteQueue.ts';

const AnalyticsContext = React.createContext(null);

export const ANALYTICS_CLIENT_ENABLED = import.meta.env.MODE === 'test'
  || import.meta.env.VITE_LIFEOS_ANALYTICS_ENABLED === 'true';

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function AnalyticsProvider({ user, children }) {
  const [sync, setSync] = React.useState({
    phase: 'idle', pending: 0, failed: 0, last_error: null, failures: [],
  });
  const [finance, setFinance] = React.useState({ data: null, loading: false, error: null });
  /* Signals are a read of derived state, not part of the durable write queue: a
     dismissal that cannot reach the server must fail visibly rather than queue
     silently, because the card staying put is the honest outcome. */
  const [signals, setSignals] = React.useState({
    data: null, loading: false, error: null, dismissing: null,
  });
  const [ready, setReady] = React.useState(false);
  const queueRef = React.useRef(null);
  const repositoryRef = React.useRef(null);
  const coordinatorRef = React.useRef(null);

  React.useEffect(() => {
    if (!ANALYTICS_CLIENT_ENABLED || !window.indexedDB) return undefined;
    const queue = new AnalyticsWriteQueue(window.indexedDB);
    const repository = new AnalyticsRepository();
    const coordinator = new AnalyticsSyncCoordinator(user.id, queue, repository, {
      locks: window.navigator.locks ?? null,
      onStatus: setSync,
    });
    queueRef.current = queue;
    repositoryRef.current = repository;
    coordinatorRef.current = coordinator;
    setReady(true);
    const online = () => { void coordinator.flush(); };
    window.addEventListener('online', online);
    void coordinator.resumeAfterAuthentication();
    return () => {
      window.removeEventListener('online', online);
      coordinator.dispose();
      queue.close();
      queueRef.current = null;
      repositoryRef.current = null;
      coordinatorRef.current = null;
      setReady(false);
    };
  }, [user.id]);

  async function enqueue(operation_type, route, payload) {
    if (!ANALYTICS_CLIENT_ENABLED) return null;
    if (!queueRef.current) throw new Error('Analytics queue is unavailable.');
    const record = await queueRef.current.enqueue({
      user_id: user.id, operation_type, route, payload,
    });
    void coordinatorRef.current?.flush();
    return record;
  }

  async function enqueueTransaction(transaction, includedByDefault = true) {
    return enqueue(
      'measurement.append',
      '/api/v1/aa/measurements',
      financeTransactionMeasurementPayload(transaction, includedByDefault),
    );
  }

  async function enqueueProjectForecast(project, forecastDate) {
    const request = projectForecastQueueRequest(project, forecastDate);
    return enqueue(request.operation_type, request.route, request.payload);
  }

  async function enqueueProjectCompletion(project, completedAt) {
    const request = projectCompletionQueueRequest(project, completedAt);
    return enqueue(request.operation_type, request.route, request.payload);
  }

  async function enqueueCorrection(transaction, originalKey, reason) {
    return enqueue(
      'measurement.correct',
      `/api/v1/aa/measurements/by-idempotency/${encodeURIComponent(originalKey)}/correct`,
      {
        value: { type: 'money', unit_code: 'UAH', num: String(transaction.amount) },
        reason,
        provenance: {
          source_kind: 'USER_REPORTED', basis: 'Исправление операции', method: 'CORRECTION',
        },
        dimensions: {
          category_id: transaction.category_id,
          included_by_default: transaction.included_in_totals !== false,
        },
      },
    );
  }

  async function enqueueMembership(measurementKey, included) {
    return enqueue('membership.set', '/api/v1/aa/finance/membership-overrides', {
      metric_key: 'finance.monthly_spend',
      measurement_idempotency_key: measurementKey,
      included,
      provenance: {
        source_kind: 'USER_REPORTED', basis: 'Настройка операции', method: 'MEMBERSHIP_OVERRIDE',
      },
    });
  }

  async function enqueuePolicy(excludeCategories) {
    return enqueue('policy.append', '/api/v1/aa/finance/policies', {
      metric_key: 'finance.monthly_spend',
      policy: { exclude_categories: excludeCategories, default: 'include' },
      effective_from: new Date().toISOString(),
      provenance: {
        source_kind: 'USER_REPORTED', basis: 'Настройка категорий', method: 'POLICY_REVISION',
      },
    });
  }

  async function enqueueExpectation(period, amount) {
    const [year, month] = period.split('-').map(Number);
    const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return enqueue('expectation.append', '/api/v1/aa/expectations', {
      subject: { domain: 'finance', type: 'period', id: period },
      metric_key: 'finance.monthly_spend',
      value: { type: 'money', unit_code: 'UAH', num: String(amount) },
      window_start: `${period}-01`,
      window_end: `${period}-${String(finalDay).padStart(2, '0')}`,
      timezone: 'Europe/Kyiv',
      effective_from: new Date().toISOString(),
      provenance: {
        source_kind: 'USER_REPORTED', basis: 'Ожидание пользователя', method: 'MANUAL',
      },
    });
  }

  async function enqueueAbsentTarget(period) {
    const [year, month] = period.split('-').map(Number);
    const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return enqueue('target.append', '/api/v1/aa/targets', {
      subject: { domain: 'finance', type: 'period', id: period },
      metric_key: 'finance.monthly_spend',
      value: null,
      is_explicitly_absent: true,
      desired_direction: 'lower',
      window_start: `${period}-01`,
      window_end: `${period}-${String(finalDay).padStart(2, '0')}`,
      timezone: 'Europe/Kyiv',
      provenance: {
        source_kind: 'USER_REPORTED', basis: 'Явное отсутствие цели', method: 'MANUAL',
      },
    });
  }

  async function loadFinance(period = currentPeriod(), signal) {
    if (!repositoryRef.current) return null;
    setFinance(previous => ({ ...previous, loading: true, error: null }));
    try {
      const data = await repositoryRef.current.readFinanceMonth(period, 'Europe/Kyiv', signal);
      setFinance({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (error?.name !== 'AbortError') setFinance({ data: null, loading: false, error });
      throw error;
    }
  }

  async function loadSignals(signal) {
    if (!repositoryRef.current) return null;
    setSignals(previous => ({ ...previous, loading: true, error: null }));
    try {
      const data = await repositoryRef.current.readSignals({ timezone: 'Europe/Kyiv' }, signal);
      setSignals({ data, loading: false, error: null, dismissing: null });
      return data;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setSignals(previous => ({ ...previous, loading: false, error }));
      }
      throw error;
    }
  }

  /* Acknowledgement is recorded against the episode, then the list is re-read so
     what the user sees is the server's state and not an optimistic guess. */
  async function acknowledgeSignal(episodeKey, inputFingerprint) {
    if (!repositoryRef.current) throw new Error('Analytics repository is unavailable.');
    setSignals(previous => ({ ...previous, dismissing: episodeKey, error: null }));
    try {
      const episode = await repositoryRef.current.acknowledgeSignal(episodeKey, inputFingerprint);
      await loadSignals();
      return episode;
    } catch (error) {
      setSignals(previous => ({ ...previous, dismissing: null, error }));
      throw error;
    }
  }

  /* Review / Debrief. Reads go straight to the server; a save or revision is
     one durable queue record → one POST → one server transaction, so nothing the
     user wrote is lost offline and a partial Review can never be stored. */
  function readReviewContext(query, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.readReviewContext({ timezone: 'Europe/Kyiv', ...query }, signal);
  }

  function readReview(reviewId, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.readReview(reviewId, signal);
  }

  function listReviews(subject, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.listReviews(subject, signal);
  }

  /* Project Analytics reads the server-acknowledged history only. Pending local
     writes for the project are counted separately (a read of the queue, never a
     mutation) so the page can say so instead of mixing them into the history. */
  function readProjectAnalytics(projectId, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.readProjectAnalytics(projectId, {}, signal);
  }

  async function pendingProjectWrites(projectId) {
    if (!queueRef.current) return 0;
    const records = await queueRef.current.list(user.id);
    return countPendingProjectWrites(records, projectId);
  }

  async function enqueueReview(request) {
    return enqueue(request.operation_type, request.route, request.payload);
  }

  /* Experiments. Every write is one durable queue record (the create carries the
     client-minted id, so children can be queued before it is acknowledged).
     Reads go to the server; the queue is only ever *read* here, never changed. */
  async function enqueueExperiment(request) {
    return enqueue(request.operation_type, request.route, request.payload);
  }

  function readExperiment(experimentId, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.readExperiment(experimentId, signal);
  }

  function listExperiments(query, signal) {
    if (!repositoryRef.current) return Promise.reject(new Error('Analytics repository is unavailable.'));
    return repositoryRef.current.listExperiments(query, signal);
  }

  async function pendingExperimentWrites(experimentId) {
    if (!queueRef.current) return [];
    const records = await queueRef.current.list(user.id);
    return experimentId == null ? pendingCreates(records) : pendingExperimentRecords(records, experimentId);
  }

  async function importLegacy() {
    if (!repositoryRef.current) throw new Error('Analytics repository is unavailable.');
    const result = await repositoryRef.current.importLegacyTransactions('Europe/Kyiv');
    await loadFinance();
    return result;
  }

  async function discardQueueFailure(queueId) {
    if (!queueRef.current) throw new Error('Analytics queue is unavailable.');
    const discarded = await queueRef.current.discard(user.id, queueId);
    if (discarded) await coordinatorRef.current?.flush();
    return discarded;
  }

  async function exportQueueFailure(queueId) {
    if (!queueRef.current) throw new Error('Analytics queue is unavailable.');
    const record = await queueRef.current.getForUser(user.id, queueId);
    if (!record) throw new Error('Analytics queue record is unavailable.');
    return JSON.stringify(record, null, 2);
  }

  const value = React.useMemo(() => ({
    enabled: ANALYTICS_CLIENT_ENABLED,
    ready,
    sync,
    finance,
    signals,
    enqueueTransaction,
    enqueueProjectForecast,
    enqueueProjectCompletion,
    enqueueCorrection,
    enqueueMembership,
    enqueuePolicy,
    enqueueExpectation,
    enqueueAbsentTarget,
    loadFinance,
    loadSignals,
    acknowledgeSignal,
    readReviewContext,
    readReview,
    listReviews,
    enqueueReview,
    readProjectAnalytics,
    pendingProjectWrites,
    enqueueExperiment,
    readExperiment,
    listExperiments,
    pendingExperimentWrites,
    importLegacy,
    discardQueueFailure,
    exportQueueFailure,
    flush: () => coordinatorRef.current?.flush(),
    currentPeriod,
  }), [sync, finance, signals, ready, user.id]);

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

function useAnalytics() {
  const value = React.useContext(AnalyticsContext);
  if (!value) throw new Error('useAnalytics must be used inside AnalyticsProvider.');
  return value;
}

export { AnalyticsContext, AnalyticsProvider, useAnalytics };
