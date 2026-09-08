/* global React */
/* F · Finance page and G · Project page — the SAME analytical grammar embedded in two
   real domains. No domain-specific analytics components: everything below is
   AADelta / AASignalCard / AAHistoryList / AAQualityStrip / AAProvenance. */

function AAFinancePage({ narrow, onHistory, onReview }) {
  const D = window.AAData;
  const F = D.finance;
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div className="aa-page-head">
        <div>
          <div className="aa-eyebrow">финансы</div>
          <h1 className="aa-page-title">Август</h1>
        </div>
        <span className="aa-status">месяц открыт · 28 / 31</span>
      </div>

      {/* ordinary finance summary — the page still reads as Finance first */}
      <div className="aa-kpis">
        <div className="stat-card"><div className="stat-eyebrow mono">расходы</div><div className="stat-value mono">₴61,200</div><div className="stat-context">28 из 31 дня</div></div>
        <div className="stat-card"><div className="stat-eyebrow mono">доходы</div><div className="stat-value mono">₴84,000</div><div className="stat-context">зачислено 2 раза</div></div>
        <div className="stat-card"><div className="stat-eyebrow mono">остаток</div><div className="stat-value mono">₴22,800</div><div className="stat-context">на сегодня</div></div>
      </div>

      {/* one inline signal — only because it is material (and here also a stakes event) */}
      <AASignalCard signal={D.signals[1]} state="material" variant="inline" narrow={narrow} onOpen={onHistory} />

      {/* embedded analytics block */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div>
            <div className="aa-block-title">Ожидание и факт</div>
            <div className="aa-quiet" style={{ marginTop: 2 }}>Ожидание вы меняли дважды — оба значения сохранены</div>
          </div>
          <button type="button" className="aa-link" onClick={onHistory}>вся история →</button>
        </div>
        <AADelta cells={[
          { label: 'ожидалось', value: '₴62,000', sub: 'сначала ₴50,000 · 1 авг' },
          { label: 'факт', value: '₴61,200', sub: F.coverage },
          { label: 'разница', value: '−₴800', delta: true, desire: 'neutral', sub: 'ниже ожидания · цель не задавалась' }
        ]} />
        <div style={{ marginTop: 12 }}>
          <div className="aa-mini"><span>Типично за месяц</span><span className="aa-mini-v">₴54,300</span></div>
          <div className="aa-mini"><span>Прогноз на конец месяца <span className="aa-quiet">если тренд сохранится</span></span><span className="aa-mini-v is-est">₴67,800</span></div>
          <div className="aa-mini"><span>Цель на месяц <span className="aa-quiet">задаёт желательность</span></span><span className="aa-mini-v" style={{ color: 'var(--fg4)' }}>не задавалась</span></div>
        </div>
        <AAQualityStrip
          items={[['покрытие', '28 / 31'], ['исправлений', '1'], ['оценочных', '0']]}
          detail={<div>
            <div className="aa-tradeoff"><span>Исправленные записи</span><span className="aa-tradeoff-v">1 · ₴12,000 → ₴1,200</span></div>
            <div className="aa-tradeoff"><span>Импорт monobank</span><span className="aa-tradeoff-v">сегодня, 08:40</span></div>
          </div>} />
      </div>

      {/* expectation history lives in the domain, collapsed by default */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Как менялось ожидание</div>
          <button type="button" className="aa-link" onClick={() => setExpanded(e => !e)}>{expanded ? 'свернуть' : 'показать'}</button>
        </div>
        {expanded ? (
          <div className="aa-hist">
            {F.expectations.map((e, i) => (
              <div className="aa-hist-row" key={i}>
                <span className="aa-hist-when">{e.when}</span>
                <span className="aa-hist-what"><b>₴{e.value.toLocaleString('en-US')}</b> · {e.note}</span>
                <span className="aa-tag" data-kind="mine">моя запись</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="aa-quiet">₴50,000 → ₴57,000 → ₴62,000 · три версии, ни одна не удалена</div>
        )}
      </div>

      <div className="aa-actions">
        <span className="aa-quiet">Ревью не обязательно. Месяц можно просто закрыть.</span>
        <button type="button" className="aa-btn aa-btn-ghost" onClick={onReview}>открыть ревью месяца</button>
      </div>

      {/* ordinary transactions continue */}
      <div className="card panel">
        <div className="panel-head"><h3 className="panel-title">Операции</h3><span className="panel-meta mono">184</span></div>
        <div className="money-list-item mono"><span className="money-list-time">14:32</span><span className="money-list-where">продукты</span><span className="money-list-amt">₴420.00</span></div>
        <div className="money-list-item mono"><span className="money-list-time">11:05</span><span className="money-list-where">транспорт</span><span className="money-list-amt">₴86.00</span></div>
        <div className="money-list-item mono"><span className="money-list-time">вчера</span><span className="money-list-where">аптека · <span className="aa-delta-strike">₴12,000</span> исправлено</span><span className="money-list-amt">₴1,200.00</span></div>
      </div>
    </div>
  );
}

function AAProjectPage({ narrow, onHistory, onReview }) {
  const D = window.AAData;
  const P = D.project;
  const versions = P.forecasts.filter(f => !f.actual);
  const first = versions[0];
  const last = versions[versions.length - 1];
  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div className="aa-page-head">
        <div>
          <div className="aa-eyebrow">проект · рабочая сущность</div>
          <h1 className="aa-page-title">Редизайн Life OS</h1>
        </div>
        <span className="aa-status is-done">завершён · 25 авг</span>
      </div>

      <div className="aa-kpis">
        <div className="stat-card"><div className="stat-eyebrow mono">задач</div><div className="stat-value mono">58</div><div className="stat-context">из них 14 добавлены позже</div></div>
        <div className="stat-card"><div className="stat-eyebrow mono">длительность</div><div className="stat-value mono">44 дн</div><div className="stat-context">{P.started} — {P.actual}</div></div>
        <div className="stat-card"><div className="stat-eyebrow mono">версий прогноза</div><div className="stat-value mono">{versions.length}</div><div className="stat-context">факт отдельно</div></div>
      </div>

      {/* same grammar as Finance: expectation / actual / delta — for a DATE */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div>
            <div className="aa-block-title">Срок: ожидание и факт</div>
            <div className="aa-quiet" style={{ marginTop: 2 }}>Две разницы, обе видимы: к первой оценке и к последнему прогнозу</div>
          </div>
          <button type="button" className="aa-link" onClick={onHistory}>история прогноза →</button>
        </div>
        <AADelta cells={[
          { label: 'первая оценка', value: first.value, sub: first.when + ' · выведено' },
          { label: 'последний прогноз', value: last.value, sub: last.when + ' · выведено', estimate: true },
          { label: 'факт', value: P.actual, sub: 'наблюдение системы' }
        ]} />
        <div style={{ height: 8 }} />
        <AADelta cells={[
          { label: 'к первой оценке', value: '+5 дней', delta: true, desire: 'neutral', sub: 'позже первой оценки (' + first.value + ')' },
          { label: 'к последнему прогнозу', value: '−1 день', delta: true, desire: 'neutral', sub: 'на день раньше ' + last.value },
          { label: 'типично для меня', value: '+3 дня', sub: 'по 6 прошлым проектам' }
        ]} />
        <AAQualityStrip
          items={[['версий прогноза', String(versions.length)], ['наблюдений', '2'], ['причина', 'не установлена']]}
          detail={<div>
            <div className="aa-tradeoff"><span>Объём</span><span className="aa-tradeoff-v">+14 задач · 16 авг</span></div>
            <div className="aa-tradeoff"><span>Субъективные наблюдения</span><span className="aa-tradeoff-v" style={{ color: 'var(--fg3)' }}>нет</span></div>
            <div className="aa-none" style={{ marginTop: 8 }}>Life OS фиксирует, что менялось. Почему — решаете вы, в ревью, если захотите.</div>
          </div>} />
      </div>

      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Что менялось</div>
          <span className="aa-quiet">семантическая история · 5 событий</span>
        </div>
        <AAHistoryList rows={P.history} />
      </div>

      <div className="aa-actions">
        <span className="aa-quiet">Проект закрыт. Ревью — по желанию.</span>
        <button type="button" className="aa-btn aa-btn-primary" onClick={onReview}>открыть ревью</button>
      </div>
    </div>
  );
}

Object.assign(window, { AAFinancePage, AAProjectPage });
