/* global React */
/* Adaptive Analytics surfaces: Home (paradise), Metric detail (light), Review. */
const { useState: useStateSc } = React;

/* ── A · HOME ─────────────────────────────────────────────── */
function AAHome({ scenario, narrow, onOpenMetric, onOpenReview }) {
  const D = window.AAData;
  const [seen, setSeen] = useStateSc([]);
  const all = D.signals;
  const shown = scenario === 'none' ? [] : (scenario === 'one' ? all.slice(0, 1) : all);
  const heroTitle = 'Четверг, 28 августа';

  return (
    <div className={'aa-col' + (narrow ? ' aa-narrow' : '')} style={{ gap: narrow ? 14 : 18 }}>
      <div>
        <div className="aa-eyebrow" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>сегодня · 5 задач в работе</div>
        <h1 style={{ font: "800 " + (narrow ? '28px' : '40px') + " 'Onest', sans-serif", letterSpacing: '-0.028em', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.4)', margin: '6px 0 0' }}>{heroTitle}</h1>
      </div>

      {/* first row of ordinary Life OS summaries — everyday state reads first */}
      <div className={narrow ? 'aa-col' : 'aa-grid2'}>
        <div className="card panel">
          <div className="panel-head"><h3 className="panel-title">Входящие</h3><span className="panel-meta mono">3 / 12</span></div>
          <div className="task-list">
            <div className="task-row is-stakes"><span className="task-check" /><span className="task-title">подписать документы</span><div className="task-meta"><span className="task-tag mono is-stakes">today</span></div></div>
            <div className="task-row"><span className="task-check" /><span className="task-title">ответить на письма</span><div className="task-meta"><span className="task-due mono">вт</span></div></div>
            <div className="task-row"><span className="task-check" /><span className="task-title">забрать заказ</span></div>
          </div>
        </div>
        <div className="card panel">
          <div className="panel-head"><h3 className="panel-title">Финансы</h3><span className="panel-meta mono">август</span></div>
          <div className="money-budget">
            <div className="money-budget-head"><span className="money-budget-lab mono">израсходовано</span><span className="money-budget-val mono">₴61,200 / ₴62,000</span></div>
            <div className="money-budget-track"><div className="money-budget-fill is-warn" style={{ width: '98%' }} /></div>
          </div>
          <div className="money-list-item mono" style={{ marginTop: 10 }}><span className="money-list-time">14:32</span><span className="money-list-where">продукты</span><span className="money-list-amt">₴420.00</span></div>
          <div className="money-list-item mono"><span className="money-list-time">11:05</span><span className="money-list-where">транспорт</span><span className="money-list-amt">₴86.00</span></div>
        </div>
      </div>

      {/* system signals — secondary observational layer, after everyday state */}
      <section className="aa-section" style={{ margin: 0 }}>
        <div className="aa-section-head">
          <span className="aa-eyebrow" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>системные сигналы</span>
          {shown.length > 0 && <button type="button" className="aa-link aa-link-scene" onClick={onOpenReview}>все ревью</button>}
        </div>
        {shown.length === 0 ? (
          <div className="aa-none" style={{ background: 'var(--surface)', borderStyle: 'solid', borderColor: 'var(--border-card)' }}>
            Ничего существенного не менялось. Данные за неделю на месте.
          </div>
        ) : (
          <div className="aa-col">
            {shown.map(s => (
              <AASignalCard key={s.id} signal={s} narrow={narrow} state={seen.includes(s.id) ? 'resolved' : undefined}
                            onOpen={() => (s.id === 'sig-review' ? onOpenReview() : onOpenMetric(s.metric))}
                            onDismiss={() => setSeen(d => d.concat(s.id))} />
            ))}
          </div>
        )}
      </section>

      <div className={narrow ? 'aa-col' : 'aa-grid2'}>
        <div className="card panel">
          <div className="panel-head"><h3 className="panel-title">Привычки</h3><span className="panel-meta mono">серия 12 дней</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['done','done','done','missed','done','today','future'].map((s, i) => <span key={i} className={'habits-cell is-' + s} />)}
          </div>
        </div>
        <div className="card panel">
          <div className="panel-head"><h3 className="panel-title">Лекарства</h3><span className="panel-meta mono">2 приёма</span></div>
          <div className="aa-quiet">Следующий приём в 21:00 · запас на 14 дней</div>
        </div>
      </div>
    </div>
  );
}

/* ── C+D · METRIC DETAIL / HISTORY ────────────────────────── */
function AAMetric({ which, narrow, onBack, onReview }) {
  const D = window.AAData;
  const [layers, setLayers] = useStateSc({ expect: true, forecast: true, typical: false, events: false });
  const toggle = k => setLayers(l => ({ ...l, [k]: !l[k] }));
  const fin = which !== 'project';
  const d = fin ? D.finance : D.project;

  const financeCells = [
    { label: 'ожидалось', value: '₴62,000', sub: 'изменено 20 авг · было ₴50,000' },
    { label: 'факт', value: '₴61,200', sub: D.finance.coverage, estimate: false },
    { label: 'разница', value: '−₴800', sub: 'ниже ожидания · цель не задавалась', delta: true, desire: 'neutral' }
  ];
  const projectCells = [
    { label: 'последний прогноз', value: '26 авг', sub: 'записан 20 авг · первая оценка 20 авг (12 авг)', estimate: true },
    { label: 'факт', value: '25 авг', sub: 'завершено' },
    { label: 'разница', value: '−1 день', sub: 'на день раньше последнего прогноза', delta: true, desire: 'neutral' }
  ];

  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div>
        <button type="button" className="aa-link" onClick={onBack}>‹ {fin ? 'финансы' : 'проект'}</button>
        <div className="aa-eyebrow" style={{ marginTop: 10 }}>{fin ? 'финансы · показатель' : 'проект · срок'}</div>
        <h1 style={{ font: "800 " + (narrow ? '24px' : '32px') + " 'Onest', sans-serif", letterSpacing: '-0.025em', color: 'var(--fg1)', margin: '6px 0 0' }}>{d.label}</h1>
        <div className="aa-help" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{fin ? 'Месяц ещё не закрыт · ' + d.coverage : 'Завершено 25 авг'}</span>
          <AAProvenance prov={fin ? D.signals[1].prov : D.signals[0].prov} label="откуда" narrow={narrow} />
        </div>
      </div>

      <AADelta cells={fin ? financeCells : projectCells} />

      {fin && (
        <div className="aa-chart-card">
          <div className="aa-chart-head">
            <div>
              <div className="aa-eyebrow aa-eyebrow-strong">история значения</div>
              <div className="aa-quiet" style={{ marginTop: 2 }}>Факт, ожидания и прогноз на одной шкале</div>
            </div>
            <AAChartLayers layers={layers} onToggle={toggle} />
          </div>
          <AAChart data={D.finance} layers={layers} narrow={narrow} />
          <div className="aa-quiet" style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px solid var(--primary)', verticalAlign: 'middle', marginRight: 6 }} />факт · 28 из 31 дня</span>
            <span style={{ color: 'var(--fg4)' }}>3 дня ещё не наступили — не считаем их нулями</span>
          </div>
          <AAQualityStrip
            items={[['покрытие', '28 / 31'], ['исправлений', '1'], ['оценочных', '0'], ['причина', 'не установлена']]}
            detail={
              <div>
                <div className="aa-tradeoff"><span>Покрытие периода</span><span className="aa-tradeoff-v">28 / 31 дня</span></div>
                <div className="aa-tradeoff"><span>Исправленные записи</span><span className="aa-tradeoff-v">1 · ₴12,000 → ₴1,200</span></div>
                <div className="aa-tradeoff"><span>Оценочные значения</span><span className="aa-tradeoff-v">0</span></div>
                <div className="aa-tradeoff"><span>Субъективные наблюдения</span><span className="aa-tradeoff-v" style={{ color: 'var(--fg3)' }}>частично</span></div>
                <div className="aa-none" style={{ marginTop: 8 }}>Причина отклонения не установлена уверенно.</div>
              </div>
            } />
        </div>
      )}

      {!fin && (
        <div className="aa-chart-card">
          <div className="aa-eyebrow aa-eyebrow-strong">как менялся прогноз</div>
          <div className="aa-hist" style={{ marginTop: 8 }}>
            {D.project.forecasts.map((fc, i) => (
              <div className="aa-hist-row" key={i} style={{ gridTemplateColumns: narrow ? '1fr' : '76px 1fr auto' }}>
                <span className="aa-hist-when">{fc.when}</span>
                <span className="aa-hist-what">{fc.actual ? <b>факт · {fc.value}</b> : <span>прогноз · <b>{fc.value}</b></span>}</span>
                <span className="aa-tag" data-kind={fc.actual ? 'observed' : 'mine'}>{fc.actual ? 'наблюдение' : 'выведено'}</span>
              </div>
            ))}
          </div>
          <div className="aa-quiet" style={{ marginTop: 10 }}>Первая оценка отличалась от факта на 5 дней; последняя — на 1 день (раньше).</div>
          <AAQualityStrip
            items={[['версий прогноза', '3'], ['наблюдений', '2'], ['причина', 'не установлена']]}
            detail={
              <div>
                <div className="aa-tradeoff"><span>Версии прогноза</span><span className="aa-tradeoff-v">3 <span className="aa-quiet">+ факт</span></span></div>
                <div className="aa-tradeoff"><span>Наблюдения системы</span><span className="aa-tradeoff-v">2</span></div>
                <div className="aa-tradeoff"><span>Субъективные наблюдения</span><span className="aa-tradeoff-v" style={{ color: 'var(--fg3)' }}>нет</span></div>
                <div className="aa-none" style={{ marginTop: 8 }}>Причина сдвига не установлена уверенно.</div>
              </div>
            } />
        </div>
      )}

      <div>
        <div className="aa-section-head">
          <span className="aa-eyebrow aa-eyebrow-strong">что менялось</span>
          <button type="button" className="aa-link" onClick={onReview}>открыть ревью</button>
        </div>
        <AAHistoryList rows={d.history} />
      </div>

      {/* H · subjective + objective side by side */}
      <div className="aa-chart-card">
        <div className="aa-eyebrow aa-eyebrow-strong">рядом · объективное и субъективное</div>
        <div className={narrow ? 'aa-col' : 'aa-grid2'} style={{ marginTop: 10 }}>
          <AADelta cells={[
            { label: 'работа', value: D.subjective.duration, sub: 'измерено системой' },
            { label: 'энергия', value: D.subjective.energy, sub: 'моя запись' },
            { label: 'стресс', value: D.subjective.stress + ' / 10', sub: 'моя запись' }
          ]} />
          <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px dashed var(--border-s)', background: 'transparent' }}>
            <div className="aa-eyebrow">наблюдение</div>
            <div style={{ fontSize: 'var(--text-md)', color: 'var(--fg1)', marginTop: 6, lineHeight: 'var(--line-body)' }}>«{D.subjective.note}»</div>
            <div className="aa-quiet" style={{ marginTop: 8 }}>{D.subjective.when}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── E · REVIEW / DEBRIEF ─────────────────────────────────── */
function AAReview({ narrow, onBack }) {
  const D = window.AAData;
  const [step, setStep] = useStateSc(0);
  const [factors, setFactors] = useStateSc(D.factors);
  const [draft, setDraft] = useStateSc('');
  const [choice, setChoice] = useStateSc(null);
  const [saved, setSaved] = useStateSc(false);

  const steps = [
    {
      q: 'Что ожидалось и что вышло?',
      help: 'Ничего заполнять не нужно — просто посмотрите.',
      body: (
        <AADelta cells={[
          { label: 'последний прогноз', value: '26 авг', sub: 'записан 20 авг', estimate: true },
          { label: 'факт', value: '25 авг' },
          { label: 'разница', value: '−1 день', delta: true, desire: 'neutral', sub: 'на день раньше прогноза' }
        ]} />
      )
    },
    {
      q: 'Что изменилось?',
      help: 'Своими словами. Можно пропустить.',
      body: (
        <div className="aa-field">
          <textarea className="aa-textarea" placeholder="Например: объём вырос после аудита дизайна." value={draft} onChange={e => setDraft(e.target.value)} />
          <span className="aa-quiet">Сохраняется в историю показателя, не в оценку вас.</span>
        </div>
      )
    },
    {
      q: 'Что могло повлиять?',
      help: 'Несколько факторов допустимы. Противоречия и «неизвестно» — тоже. Тип фактора выбирается в меню.',
      body: (
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
          <div className="aa-factor" style={{ borderStyle: 'dashed' }}>
            <span className="aa-factor-text" style={{ color: 'var(--fg4)' }}>добавить фактор…</span>
            <button type="button" className="aa-tag" data-kind="unknown"
                    onClick={() => setFactors(list => list.concat({ id: 'f' + (list.length + 1), text: 'Новый фактор', kind: 'unknown' }))}>+ добавить</button>
            <span />
          </div>
          <div className="aa-none">Причина может остаться неизвестной — это нормальное состояние.</div>
        </div>
      )
    },
    {
      q: 'Чего это стоило?',
      help: 'Просто рядом. Общий балл не считается.',
      body: (
        <div>
          {D.tradeoffs.map((t, i) => (
            <div className="aa-tradeoff" key={i}><span>{t.label}</span><span className="aa-tradeoff-v">{t.value}</span></div>
          ))}
          <div className="aa-quiet" style={{ marginTop: 10 }}>Стоило это того или нет — решаете вы. Life OS не считает.</div>
        </div>
      )
    },
    {
      q: 'Что дальше?',
      help: 'Можно ничего не менять.',
      body: (
        <div className="aa-choice">
          {[['keep', 'Оставить как есть'], ['adjust', 'Скорректировать ожидание на сентябрь'], ['later', 'Вернуться к этому позже'], ['none', 'Пока без решения']].map(([k, lab]) => (
            <button type="button" key={k} className={'aa-choice-btn' + (choice === k ? ' is-on' : '')} onClick={() => setChoice(k)}>{lab}</button>
          ))}
        </div>
      )
    }
  ];

  if (saved) {
    return (
      <div className="aa-col aa-max" style={{ gap: 14 }}>
        <button type="button" className="aa-link" onClick={onBack}>‹ назад</button>
        <div className="aa-chart-card">
          <div className="aa-eyebrow aa-eyebrow-strong">ревью сохранено</div>
          <h2 className="aa-q" style={{ marginTop: 8 }}>Записано в историю проекта</h2>
          <div className="aa-help">Ревью можно открыть снова и дополнить. Ничего не оценивалось.</div>
          <div style={{ marginTop: 14 }}>
            <AAHistoryList rows={[{ when: '28 авг', what: '<b>Ревью создано</b> · +1 день к последнему прогнозу', prov: 'Моя запись' }].concat(D.project.history.slice(0, 3))} />
          </div>
        </div>
      </div>
    );
  }

  const s = steps[step];
  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 14, maxWidth: 620 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" className="aa-link" onClick={onBack}>‹ выйти</button>
        <div className="aa-steps">
          {steps.map((_, i) => <span key={i} className={'aa-step-dot' + (i === step ? ' is-on' : (i < step ? ' is-done' : ''))} />)}
        </div>
      </div>

      <div>
        <div className="aa-eyebrow">ревью · редизайн life os</div>
        <h2 className="aa-q" style={{ marginTop: 8 }}>{s.q}</h2>
        <div className="aa-help">{s.help}</div>
      </div>

      <div>{s.body}</div>

      <div className="aa-actions">
        <button type="button" className="aa-btn aa-btn-ghost" onClick={() => (step === steps.length - 1 ? setSaved(true) : setStep(step + 1))}>
          пропустить
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setStep(step - 1)}>назад</button>}
          <button type="button" className="aa-btn aa-btn-primary" onClick={() => (step === steps.length - 1 ? setSaved(true) : setStep(step + 1))}>
            {step === steps.length - 1 ? 'сохранить ревью' : 'дальше'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── B · signal card state gallery ───────────────────────── */
function AASignalStates({ narrow }) {
  const D = window.AAData;
  const base = D.signals[0];
  const fin = D.signals[1];
  const rows = [
    ['обычный', { ...base, kind: 'normal' }, 'normal'],
    ['существенный · нейтрально', base, 'material'],
    ['существенный · событие stakes (бюджет ≥ 80%)', fin, 'material'],
    ['информационный', D.signals[2], 'info'],
    ['устаревшие данные', { ...fin, body: 'Последний импорт 9 дней назад. Значение может быть неполным.' }, 'stale'],
    ['частичные данные', { ...fin, body: 'Покрыто 21 из 31 дня. Остальное не считаем нулями.' }, 'partial'],
    ['просмотрено', base, 'resolved']
  ];
  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 14 }}>
      <div>
        <div className="aa-eyebrow">примитив 01</div>
        <h1 style={{ font: "800 28px 'Onest', sans-serif", letterSpacing: '-0.025em', color: 'var(--fg1)', margin: '6px 0 0' }}>Signal Card · состояния</h1>
        <div className="aa-help">Важность — сильнее граница и точка, не заливка и не цвет. Оранжевый появляется только если событие само по себе stakes.</div>
      </div>
      {rows.map(([lab, sig, st]) => (
        <div key={st + lab}>
          <div className="aa-eyebrow" style={{ marginBottom: 6 }}>{lab}</div>
          <AASignalCard signal={sig} state={st} narrow={narrow} onOpen={() => {}} onDismiss={() => {}} />
        </div>
      ))}
    </div>
  );
}

/* ── C · delta variants gallery ──────────────────────────── */
function AADeltaStates({ narrow }) {
  const sets = [
    ['деньги · ниже ожидания, но цель не задавалась → нейтрально', [
      { label: 'ожидалось', value: '₴62,000', sub: 'изменено 20 авг' },
      { label: 'факт', value: '₴61,200', sub: '28 из 31 дня' },
      { label: 'разница', value: '−₴800', delta: true, desire: 'neutral', sub: 'ниже ожидания · цель не задавалась' }
    ]],
    ['деньги · выше первоначального ожидания → тоже нейтрально', [
      { label: 'сначала ожидалось', value: '₴50,000', sub: '1 авг' },
      { label: 'факт', value: '₴61,200' },
      { label: 'разница', value: '+₴11,200', delta: true, desire: 'neutral', sub: 'выше первой оценки · цель не задавалась' }
    ]],
    ['дата · к первой оценке', [
      { label: 'первая оценка', value: '20 авг', sub: 'записана 12 авг' },
      { label: 'факт', value: '25 авг' },
      { label: 'разница', value: '+5 дней', delta: true, desire: 'neutral' }
    ]],
    ['длительность · направление без оценки', [
      { label: 'типично', value: '6 ч 18 м' },
      { label: 'наблюдение', value: '6 ч 42 м' },
      { label: 'разница', value: '+24 м', delta: true, desire: 'neutral', sub: 'желательность не определена' }
    ]],
    ['неполный факт', [
      { label: 'ожидалось', value: '₴62,000' },
      { label: 'факт', value: '₴41,900', sub: 'ещё считается · 21 из 31 дня', estimate: true },
      { label: 'разница', value: 'рано судить', delta: true, desire: 'unknown' }
    ]],
    ['вместо факта — прогноз', [
      { label: 'ожидалось', value: '₴62,000' },
      { label: 'прогноз', value: '₴67,800', sub: 'выведено Life OS', estimate: true },
      { label: 'разница', value: '+₴5,800', delta: true, desire: 'neutral', sub: 'прогноз выше ожидания · если тренд сохранится' }
    ]],
    ['нет данных', [
      { label: 'ожидалось', value: '—', empty: true, sub: 'не задавалось' },
      { label: 'факт', value: 'нет данных', empty: true },
      { label: 'разница', value: '—', empty: true, delta: true, desire: 'unknown' }
    ]]
  ];
  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 14 }}>
      <div>
        <div className="aa-eyebrow">примитив 02</div>
        <h1 style={{ font: "800 28px 'Onest', sans-serif", letterSpacing: '-0.025em', color: 'var(--fg1)', margin: '6px 0 0' }}>Ожидалось / факт / разница</h1>
        <div className="aa-help">Знак, желательность и серьёзность — разные вещи. Ожидание предсказывает, а не предписывает: «ниже ожидания» само по себе не «лучше». Желательность появляется только при цели, ориентире или решении.</div>
      </div>
      {sets.map(([lab, cells]) => (
        <div key={lab}>
          <div className="aa-eyebrow" style={{ marginBottom: 6 }}>{lab}</div>
          <AADelta cells={cells} />
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AAHome, AAMetric, AAReview, AASignalStates, AADeltaStates });
