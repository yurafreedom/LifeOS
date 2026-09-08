/* global React */
/* I · Experiment — a FUTURE first-class capability, built entirely from the
   existing analytics grammar: AADelta (baseline vs observation), AAHistoryList
   (semantic events), AAQualityStrip (adherence + conditions), AAProvenance,
   AAFactorTag (epistemic tags), and the review flow's choice list.
   No second analytical system, no score, no automatic recommendation. */
const { useState: useStateExp } = React;

const AA_EXP_STAGES = [
  ['hypothesis', 'гипотеза'],
  ['baseline', 'базовый уровень'],
  ['run', 'период'],
  ['observe', 'наблюдения'],
  ['result', 'результат'],
  ['decision', 'решение']
];

function AAExpStages({ status }) {
  const reached = { draft: 1, running: 3, review: 5, decided: 6 }[status] || 1;
  return (
    <div className="aa-exp-stage">
      {AA_EXP_STAGES.map(([k, lab], i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className="aa-exp-arrow">→</span>}
          <span className={'aa-exp-step' + (i + 1 < reached ? ' is-done' : (i + 1 === reached ? ' is-now' : ''))}>{lab}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function AAAdherence({ adherence, narrow }) {
  /* kept → соблюдено · missed → прошло без соблюдения · future → ещё не наступило.
     Elapsed and total come from the data; missing days are never drawn as misses. */
  const elapsed = adherence.elapsed != null ? adherence.elapsed : adherence.total;
  const cells = [];
  for (let i = 0; i < adherence.total; i++) {
    const kind = i < adherence.kept ? 'kept' : (i < elapsed ? 'missed' : 'future');
    cells.push(<span key={i} className={'aa-adh is-' + kind} title={kind} />);
  }
  return (
    <div className="aa-adherence">
      <div className="aa-adherence-dots">{cells}</div>
      <div className="aa-quiet">
        соблюдено {adherence.kept} из {elapsed} прошедших дней · период {adherence.total} дн. · {adherence.note}
      </div>
      {!narrow && <div className="aa-quiet" style={{ color: 'var(--fg4)' }}>Частичное соблюдение — обычное состояние, а не брак данных.</div>}
    </div>
  );
}

function AAExperiment({ narrow, onBack, onReview }) {
  const D = window.AAData;
  const [idx, setIdx] = useStateExp(0);
  const [decision, setDecision] = useStateExp(null);
  const [factors, setFactors] = useStateExp([
    { id: 'x1', text: 'Правило соблюдалось 9 из 14 дней', kind: 'observed' },
    { id: 'x2', text: 'Две поездки могли сдвинуть режим', kind: 'maybe' },
    { id: 'x3', text: 'Причина роста сна не установлена', kind: 'unknown' }
  ]);
  const E = D.experiments[idx];
  const done = E.status === 'review' || E.status === 'decided';

  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div>
        <button type="button" className="aa-link" onClick={onBack}>‹ назад</button>
        <div className="aa-eyebrow" style={{ marginTop: 10 }}>эксперимент · будущая возможность</div>
        <h1 className="aa-page-title">{E.title}</h1>
        <div className="aa-help" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{E.window}</span>
          <span className="aa-quality-sep">·</span>
          <span>{done ? 'период закончен, решение не принято' : 'идёт'}</span>
          <AAProvenance prov={E.baseline.prov} label="откуда базовый уровень" narrow={narrow} />
        </div>
      </div>

      <div className="aa-layers">
        {D.experiments.map((x, i) => (
          <button key={x.id} type="button" className={'aa-layer' + (i === idx ? ' is-on' : '')} onClick={() => setIdx(i)}>{x.title}</button>
        ))}
      </div>

      <AAExpStages status={E.status} />

      {/* hypothesis is a claim, not a fact — dashed container, explicit label, никогда не как результат */}
      <div className="aa-exp-claim">
        <div className="aa-exp-claim-lab">гипотеза · предположение, не факт</div>
        <div className="aa-exp-claim-text">«{E.hypothesis}»</div>
        <div className="aa-quiet" style={{ marginTop: 8 }}>{E.hypothesisWhen}</div>
      </div>

      {/* baseline / intervention / window stay separate cells */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div>
            <div className="aa-block-title">Базовый уровень и вмешательство</div>
            <div className="aa-quiet" style={{ marginTop: 2 }}>Это разные вещи и хранятся отдельно</div>
          </div>
        </div>
        {/* facts, not delta operands — same layout, different component */}
        <AAFacts cells={[
          { label: 'базовый уровень', value: E.baseline.value, sub: E.baseline.window },
          { label: 'вмешательство', value: narrow ? 'одно' : '1 изменение', sub: E.intervention },
          { label: 'период', value: E.window.split(' · ')[0], sub: E.window.split(' · ')[1] }
        ]} />
        <div style={{ marginTop: 12 }}>
          <div className="aa-eyebrow" style={{ marginBottom: 8 }}>соблюдение</div>
          <AAAdherence adherence={E.adherence} narrow={narrow} />
        </div>
        <AAQualityStrip
          items={[['соблюдено', E.adherence.kept + ' / ' + (E.adherence.elapsed != null ? E.adherence.elapsed : E.adherence.total)], ['дней прошло', (E.adherence.elapsed != null ? E.adherence.elapsed : E.adherence.total) + ' / ' + E.adherence.total], ['условия изменились', String(E.conditions.length)], ['причина', 'не установлена']]}
          detail={
            <div>
              {E.conditions.length === 0
                ? <div className="aa-none">Изменений условий не зафиксировано. Это не означает, что их не было.</div>
                : E.conditions.map((c, i) => (
                    <div className="aa-tradeoff" key={i}><span>{c.text}</span><span className="aa-tag" data-kind={c.kind}>наблюдение</span></div>
                  ))}
              <div className="aa-warn-note" style={{ marginTop: 8 }}>
                Изменившиеся условия и частичное соблюдение сохраняются рядом с результатом — без них цифра значит меньше.
              </div>
            </div>
          } />
      </div>

      {/* observations — measurements, not conclusions */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Наблюдения за период</div>
          <span className="aa-quiet">измерения, не выводы</span>
        </div>
        <div>
          {E.observations.map((o, i) => (
            <div className="aa-mini" key={i}>
              <span>{o.label} <span className="aa-quiet">· {o.prov}</span></span>
              <span className="aa-mini-v">{o.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* result — a difference, explicitly not proof of causality */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Результат</div>
          {done && <span className="aa-quiet">период закончен · 14 из 14 дней</span>}
        </div>
        {E.result ? (
          <React.Fragment>
            <AADelta cells={[
              { label: 'базовый уровень', value: E.baseline.value, sub: 'до вмешательства' },
              { label: 'за период', value: E.observations[0].value, sub: 'среднее по 12 дням с записью', estimate: true },
              { label: 'разница', value: E.result.delta, delta: true, desire: E.result.desire, sub: E.result.sub }
            ]} />
            <div className="aa-warn-note" style={{ marginTop: 12 }}>
              Разница — это разница, а не доказательство причины. Правило соблюдалось 9 из 14 дней, в период попали две поездки и аллергия.
              Life OS не утверждает, что сон вырос из-за вмешательства.
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <AADelta cells={[
              { label: 'базовый уровень', value: E.baseline.value, sub: 'до вмешательства' },
              { label: 'пока за период', value: E.observations[0].value, sub: '9 из 21 дня', estimate: true },
              { label: 'разница', value: 'рано судить', delta: true, desire: 'unknown', sub: 'период не закончен' }
            ]} />
            <div className="aa-warn-note" style={{ marginTop: 12 }}>
              Промежуточные значения показываются, но результат не считается до конца периода.
            </div>
          </React.Fragment>
        )}
      </div>

      {/* what may have contributed — same factor rows as Review, unknown included */}
      {done && (
        <div className="aa-chart-card">
          <div className="aa-block-head">
            <div className="aa-block-title">Что могло повлиять</div>
            <span className="aa-quiet">тот же примитив, что в ревью</span>
          </div>
          <div className="aa-col">
            {factors.map(fa => (
              <div className="aa-factor" key={fa.id}>
                <span className="aa-factor-text">{fa.text}</span>
                <AAFactorTag kind={fa.kind}
                             onChange={k => setFactors(list => list.map(x => x.id === fa.id ? { ...x, kind: k } : x))}
                             onRemove={() => setFactors(list => list.filter(x => x.id !== fa.id))} />
                <span />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* decision — the user's, never suggested by the system */}
      {done && (
        <div className="aa-chart-card">
          <div className="aa-block-head">
            <div className="aa-block-title">Решение</div>
            <span className="aa-quiet">решаете вы · «непонятно» — нормальный итог</span>
          </div>
          <div className="aa-choice">
            {[['keep', 'Оставить правило'], ['modify', 'Изменить условия и повторить'], ['longer', 'Продлить период'], ['reject', 'Отказаться'], ['inconclusive', 'Непонятно — данных недостаточно']].map(([k, lab]) => (
              <button type="button" key={k} className={'aa-choice-btn' + (decision === k ? ' is-on' : '')} onClick={() => setDecision(k)}>{lab}</button>
            ))}
          </div>
          <div className="aa-actions" style={{ marginTop: 12 }}>
            <span className="aa-quiet">Решение можно не принимать. Эксперимент останется в истории.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="aa-btn aa-btn-ghost" onClick={onReview}>открыть ревью</button>
              <button type="button" className="aa-btn aa-btn-primary" onClick={() => {}}>сохранить</button>
            </div>
          </div>
        </div>
      )}

      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Что менялось</div>
          <span className="aa-quiet">семантическая история</span>
        </div>
        <AAHistoryList rows={done ? [
          { when: '14 авг', what: '<b>Период закончен</b> · 14 из 14 дней', prov: 'Наблюдение системы' },
          { when: '9 авг', what: 'Условия изменились · аллергия 6–9 авг', prov: 'Моя запись' },
          { when: '5 авг', what: 'Правило не соблюдалось · 5-й день', prov: 'Наблюдение системы' },
          { when: '1 авг', what: '<b>Эксперимент начат</b> · базовый уровень 6 ч 18 м', prov: 'Моя запись' },
          { when: '31 июл', what: 'Базовый уровень зафиксирован · 14 наблюдений', prov: 'Выведено Life OS' }
        ] : [
          { when: '28 авг', what: 'Правило соблюдалось · 6 из 9 дней', prov: 'Наблюдение системы' },
          { when: '20 авг', what: '<b>Эксперимент начат</b> · базовый уровень 6.4 / 10', prov: 'Моя запись' }
        ]} />
      </div>

      <div className="aa-warn-note">
        <b style={{ color: 'var(--fg1)' }}>Как это относится к остальной аналитике.</b> Эксперимент не вводит новых понятий:
        базовый уровень — это baseline, наблюдения — это факт, разница — тот же AADelta,
        соблюдение и условия — качество данных, «что могло повлиять» — факторы из ревью, решение — выбор из ревью.
      </div>
    </div>
  );
}

Object.assign(window, { AAExperiment, AAExpStages, AAAdherence });
