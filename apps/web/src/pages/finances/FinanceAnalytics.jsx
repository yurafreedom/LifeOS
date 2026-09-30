import React from 'react';
import AADelta from '../../components/analytics/AADelta.jsx';
import AAFacts from '../../components/analytics/AAFacts.jsx';
import AAHistoryList from '../../components/analytics/AAHistoryList.jsx';
import AAProvenance from '../../components/analytics/AAProvenance.jsx';
import AAQualityStrip from '../../components/analytics/AAQualityStrip.jsx';
import AAChart from '../../components/analytics/AAChart.jsx';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { useAnalytics } from '../../context/AnalyticsContext.jsx';
import { formatValue } from '../../analytics/values.ts';
import { financeReviewWindow, newReviewHash } from '../../analytics/review';
import { useAAText } from '../../components/analytics/useAAText.js';

function derivedActual(month) {
  if (!month.actual) return null;
  return {
    id: `derived:${month.subject_key}`,
    concept: 'actual',
    value: month.actual,
    metric_key: 'finance.monthly_spend',
    provenance: {
      source_kind: 'DERIVED',
      basis: `${month.transaction_count} включённых операций`,
      method: month.derivation,
      recorded_at: month.as_of,
      source_ref: null,
      original_recorded_at_known: true,
    },
  };
}

function QueueFailures({ failures, onDiscard, onExport }) {
  if (!failures.length) return null;
  return <section className="card panel" aria-label="Ошибки очереди аналитики">
    <h3 className="panel-title">Требуют решения · {failures.length}</h3>
    <p className="aa-note">Записи сохранены локально и не удаляются автоматически.</p>
    <ul className="fin-tx-list">
      {failures.map(failure => <li className="fin-tx" key={failure.queue_id}>
        <div className="fin-tx-where">
          <strong>{failure.operation_type}</strong>
          <span className="fin-tx-desc">
            {failure.last_error_status ?? 'local'} · {failure.last_error_code ?? failure.state}
            {failure.last_error_message ? ` · ${failure.last_error_message}` : ''}
          </span>
        </div>
        <button className="set-btn-ghost" type="button" onClick={() => onExport(failure.queue_id)}>
          Экспорт
        </button>
        <button className="set-btn-ghost" type="button" onClick={() => onDiscard(failure.queue_id)}>
          Удалить из очереди
        </button>
      </li>)}
    </ul>
  </section>;
}

export default function FinanceAnalytics({ onHistory }) {
  const analytics = useAnalytics();
  const t = useAAText();
  const month = analytics.finance.data;
  const [importMessage, setImportMessage] = React.useState('');
  const [expectationAmount, setExpectationAmount] = React.useState('');
  React.useEffect(() => {
    const controller = new window.AbortController();
    if (analytics.ready) {
      void analytics.loadFinance(analytics.currentPeriod(), controller.signal).catch(() => undefined);
    }
    return () => controller.abort();
  }, [analytics.ready]);

  if (analytics.finance.loading && !month) return <section className="card panel">Загрузка аналитики…</section>;
  if (analytics.finance.error) return <section className="card panel">Аналитика недоступна: {analytics.finance.error.message}</section>;
  if (!month) return <section className="card panel">Аналитика ещё не загружена.</section>;

  const actual = derivedActual(month);
  const expectation = month.current_expectation;
  const target = month.current_target;
  const summary = {
    actual: actual ? [actual] : [],
    expectations: month.expectations,
    targets: month.targets,
    forecasts: [], observations: [], baselines: [],
  };
  const comparison = {
    metric_key: 'finance.monthly_spend',
    current_concept: actual ? 'actual' : null,
    current_id: actual?.id ?? null,
    reference_concept: expectation ? 'expectation' : null,
    reference_id: expectation?.id ?? null,
    availability: month.availability,
    delta: month.delta,
    desire: month.desire,
    grounding_id: target && !target.is_explicitly_absent ? target.id : null,
    grounding_kind: target && !target.is_explicitly_absent ? 'target' : null,
    coverage: month.coverage,
  };
  const history = [...month.expectations, ...month.targets]
    .sort((left, right) => left.provenance.recorded_at.localeCompare(right.provenance.recorded_at));

  async function runImport() {
    setImportMessage('Импорт…');
    try {
      const result = await analytics.importLegacy();
      setImportMessage(`Импортировано: ${result.transactions_imported}; повторов: ${result.transactions_replayed}`);
    } catch (error) {
      setImportMessage(`Импорт не выполнен: ${error.message}`);
    }
  }

  async function recordExpectation(event) {
    event.preventDefault();
    if (!/^\d+(?:\.\d{1,2})?$/.test(expectationAmount) || Number(expectationAmount) < 0) return;
    await analytics.enqueueExpectation(month.period, expectationAmount);
    setExpectationAmount('');
    setImportMessage('Ожидание сохранено в durable-очереди.');
  }

  async function recordAbsentTarget() {
    await analytics.enqueueAbsentTarget(month.period);
    setImportMessage('Явное отсутствие цели сохранено в durable-очереди.');
  }

  async function exportFailure(queueId) {
    const json = await analytics.exportQueueFailure(queueId);
    const url = window.URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifeos-aa-queue-${queueId}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return <section className="fin-aa" aria-label="Финансовая аналитика">
    <PageHeader
      title={`Финансы · ${month.period}`}
      subtitle={`AA sync: ${analytics.sync.phase} · очередь: ${analytics.sync.pending}`}
      aside={<div className="panel-head-right">
        <button className="set-btn-ghost" type="button" onClick={runImport}>Импортировать существующие операции</button>
        {onHistory ? <button className="set-btn-ghost" type="button" onClick={onHistory}>История метрики</button> : null}
        {/* Frozen F: the month review is optional, so it is a ghost action. */}
        <a className="set-btn-ghost" href={newReviewHash(month.subject_key, financeReviewWindow(month.period).from, financeReviewWindow(month.period).to)}>{t('aa_rv_month_review')}</a>
      </div>}
    />
    {importMessage ? <p className="mono">{importMessage}</p> : null}
    <QueueFailures
      failures={analytics.sync.failures ?? []}
      onDiscard={analytics.discardQueueFailure}
      onExport={exportFailure}
    />
    <form className="fin-logger" onSubmit={recordExpectation}>
      <div className="money-input-wrap"><span className="money-prefix mono">₴</span>
        <input className="money-input mono" inputMode="decimal" value={expectationAmount}
          onChange={event => setExpectationAmount(event.target.value)} placeholder="Новое ожидание" /></div>
      <button className="money-log" type="submit">Сохранить ожидание</button>
      <button className="set-btn-ghost" type="button" onClick={recordAbsentTarget}>Цель не задавалась</button>
    </form>
    <div className="card panel">
      <AAFacts facts={[...(actual ? [actual] : []), ...(target ? [target] : [])]} />
      {month.retention_truncated ? <p className="aa-retention-note" role="note">
        {t('aa_ret_finance_truncated', month.retention_horizon)}
      </p> : null}
      <AADelta summary={summary} comparison={comparison} />
      <AAQualityStrip coverage={month.coverage} />
      {month.coverage.future_count ? <p className="aa-note">{month.coverage.future_count} дня ещё не наступили и не считаются нулями.</p> : null}
      {month.unknown_membership_count ? <p className="aa-note">Часть исторического состава неизвестна; показан только известный subtotal {formatValue(month.known_subtotal)}.</p> : null}
      {target?.is_explicitly_absent ? <p className="aa-note">Цель на месяц явно не задавалась. Это не ₴0.</p> : !target ? <p className="aa-note">Факт цели отсутствует.</p> : null}
      {actual ? <div className="aa-source-line"><AAProvenance provenance={actual.provenance} /></div> : null}
    </div>
    <div className="card panel"><h3 className="panel-title">Операции по дням</h3><AAChart points={month.series} /></div>
    <div className="card panel"><h3 className="panel-title">Ожидания и цель</h3><AAHistoryList facts={history} /></div>
  </section>;
}
