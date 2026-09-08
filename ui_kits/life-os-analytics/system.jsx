/* global React */
/* J · Trade-off juxtaposition + System Review — exploration, later phase.
   Core rule: juxtaposition, not optimization. Nothing here combines unlike
   units, scores anything, or issues a verdict. Meaning is supplied by the user. */
const { useState: useStateJ } = React;

const AA_IMPORTANCE = [
  ['none', 'не решил'],
  ['matters', 'для меня важно'],
  ['ok', 'приемлемо'],
  ['ignore', 'не считаю значимым']
];

function AAImportance({ value, onChange, placement }) {
  const [open, setOpen] = useStateJ(false);
  const label = (AA_IMPORTANCE.find(k => k[0] === (value || 'none')) || AA_IMPORTANCE[0])[1];
  return (
    <span className="aa-tag-wrap">
      <button type="button" className="aa-tag" data-kind={value && value !== 'none' ? 'mine' : 'unknown'}
              aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label} ▾</button>
      {open && (
        <span className={'aa-menu' + (placement === 'left' ? ' is-left' : '')} role="menu">
          {AA_IMPORTANCE.map(([k, lab]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === (value || 'none')}
                    className={'aa-menu-item' + (k === (value || 'none') ? ' is-on' : '')}
                    onClick={() => { onChange(k); setOpen(false); }}>
              <span>{lab}</span>
              {k === 'none' && <span className="aa-quiet" style={{ fontSize: 10 }}>оставить без оценки</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/* ── J1 · TRADE-OFF VIEW ─────────────────────────────────── */
function AATradeoffView({ narrow, onBack, onSystem }) {
  const D = window.AAData;
  const C = D.changes;
  const [importance, setImportance] = useStateJ({});
  const [meaning, setMeaning] = useStateJ('');
  const [noConclusion, setNoConclusion] = useStateJ(false);

  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div>
        <button type="button" className="aa-link" onClick={onBack}>‹ назад</button>
        <div className="aa-eyebrow" style={{ marginTop: 10 }}>компромиссы · позднейшая фаза</div>
        <h1 className="aa-page-title">Что менялось одновременно</h1>
        <div className="aa-help">{C.window} · показано рядом, не сведено в одно число</div>
      </div>

      <div className="aa-banner">
        <b>Общего балла нет и не будет.</b> Разные единицы — часы, штуки, минуты, ₴, субъективная шкала —
        не складываются. Life OS показывает изменения рядом; что из этого важно, решаете вы.
      </div>

      <div className="aa-changes">
        {C.items.map(it => (
          <div className="aa-change" key={it.id}>
            <div className="aa-change-top">
              <span className="aa-signal-dot" />
              <span className="aa-change-dom">{it.domain}</span>
              {it.coverage.indexOf('частичное') === 0 && <span className="aa-tag" data-kind="maybe">частичные данные</span>}
            </div>
            <div className="aa-sr-text">{it.label}</div>
            <div className="aa-change-val">{it.value}</div>
            <div className="aa-change-unit">{it.unit}</div>
            <div className="aa-change-foot">
              <span className="aa-quiet">покрытие: {it.coverage}</span>
              <AAProvenance prov={it.prov} narrow={narrow} />
            </div>
            <div className="aa-change-foot">
              <AAImportance value={importance[it.id]} placement="left" onChange={k => setImportance(m => ({ ...m, [it.id]: k }))} />
            </div>
          </div>
        ))}
      </div>

      {/* contradiction: two signals that disagree, kept side by side */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Противоречие</div>
          <span className="aa-quiet">оба наблюдения остаются в силе</span>
        </div>
        <div className="aa-pair">
          <div>
            <div className="aa-change-unit">выросло</div>
            <div className="aa-change-val">+24%</div>
            <div className="aa-quiet">задач закрыто · полное покрытие</div>
          </div>
          <div className="aa-pair-vs">одновременно</div>
          <div>
            <div className="aa-change-unit">упало</div>
            <div className="aa-change-val">−11%</div>
            <div className="aa-quiet">сон · 19 из 28 дней</div>
          </div>
        </div>
        <div className="aa-warn-note" style={{ marginTop: 12 }}>
          Совпадение по дням есть, причинная связь не проверялась. Life OS не утверждает, что одно вызвало другое,
          и не считает, стоило ли оно того.
        </div>
      </div>

      {/* the user supplies meaning; no conclusion is a valid end state */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Что это значит для меня</div>
          <span className="aa-quiet">необязательно</span>
        </div>
        <div className="aa-field">
          <textarea className="aa-textarea" placeholder="Например: месяц был плотный осознанно, сон верну в сентябре."
                    value={meaning} onChange={e => setMeaning(e.target.value)} disabled={noConclusion} />
        </div>
        <button type="button" className={'aa-checkline' + (noConclusion ? ' is-on' : '')} style={{ marginTop: 10 }}
                onClick={() => setNoConclusion(v => !v)}>
          <span className="aa-checkbox" />
          <span className="aa-sr-text">Вывода нет — оставить как наблюдение</span>
        </button>
        <div className="aa-actions" style={{ marginTop: 12 }}>
          <span className="aa-quiet">Ничего не обязательно заполнять.</span>
          <button type="button" className="aa-btn aa-btn-ghost" onClick={onSystem}>обзор системы →</button>
        </div>
      </div>
    </div>
  );
}

/* ── J2 · SYSTEM REVIEW ──────────────────────────────────── */
function AASystemReview({ narrow, onBack, onTradeoff, onReview }) {
  const D = window.AAData;
  const S = D.systemReview;
  const [picked, setPicked] = useStateJ([]);
  const toggle = i => setPicked(p => p.includes(i) ? p.filter(x => x !== i) : p.concat(i));

  const group = (title, items, note) => (
    <div className="aa-chart-card">
      <div className="aa-block-head">
        <div className="aa-block-title">{title}</div>
        {note && <span className="aa-quiet">{note}</span>}
      </div>
      {items.length === 0
        ? <div className="aa-none">Нечего показать за период.</div>
        : <div className="aa-sr-group">
            {items.map((it, i) => (
              <div className="aa-sr-item" key={i}>
                <span>
                  <span className="aa-sr-text" dangerouslySetInnerHTML={{ __html: it.text }} />
                  {it.basis && <span className="aa-quiet" style={{ display: 'block', marginTop: 4 }}>{it.basis}</span>}
                </span>
                <span className="aa-tag" data-kind={it.prov === 'Наблюдение системы' ? 'observed' : (it.prov === 'Выведено Life OS' ? 'mine' : 'maybe')}>{it.prov}</span>
              </div>
            ))}
          </div>}
    </div>
  );

  return (
    <div className={'aa-col aa-max' + (narrow ? ' aa-narrow' : '')} style={{ gap: 16 }}>
      <div>
        <button type="button" className="aa-link" onClick={onBack}>‹ назад</button>
        <div className="aa-eyebrow" style={{ marginTop: 10 }}>обзор системы · позднейшая фаза</div>
        <h1 className="aa-page-title">Август · что известно</h1>
        <div className="aa-help">Сводка свидетельств. Не оценка месяца и не оценка вас.</div>
      </div>

      <div className="aa-banner">
        <b>Это не вердикт.</b> Обзор собирает то, что менялось, повторялось и осталось неясным.
        Он не расставляет приоритеты и ничего не предписывает — решения ниже выбираете вы.
      </div>

      {group('Что менялось', S.changed)}
      {group('Что улучшилось', S.improved, 'только там, где «лучше» задано вами')}
      <div className="aa-warn-note" style={{ marginTop: -8 }}>
        Сюда попадает только то, где желательность задана вами — цель, ориентир или решение.
        Ожидание не подходит: оно предсказывает, а не предписывает. Рост или падение числа сам по себе
        тоже не улучшение — такие изменения остаются в «Что менялось».
      </div>
      {group('Что повторилось', S.repeated, 'закономерность, не приговор')}
      {group('Противоречия', S.contradictions, 'остаются рядом')}

      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Ждёт вас</div>
          <span className="aa-quiet">необязательно</span>
        </div>
        <div className="aa-mini"><span>Ревью доступно</span><span className="aa-mini-v">{S.pending.reviews}</span></div>
        <div className="aa-mini"><span>Эксперименты</span><span className="aa-mini-v">{S.pending.experiments}</span></div>
        <div className="aa-actions" style={{ marginTop: 12 }}>
          <button type="button" className="aa-btn aa-btn-ghost" onClick={onTradeoff}>компромиссы месяца</button>
          <button type="button" className="aa-btn aa-btn-ghost" onClick={onReview}>открыть ревью</button>
        </div>
      </div>

      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Качество данных</div>
          <span className="aa-quiet">чего не хватало, чтобы судить</span>
        </div>
        <div className="aa-sr-group">
          {S.quality.map((q, i) => (
            <div className="aa-sr-item" key={i}>
              <span className="aa-sr-text">{q.text}</span>
              <span className="aa-tag" data-kind="maybe">{q.prov}</span>
            </div>
          ))}
        </div>
        <div className="aa-none" style={{ marginTop: 10 }}>Неполное покрытие не заменяется нулями и не достраивается оценкой.</div>
      </div>

      {/* adjustments are user-owned choices, never system prescriptions */}
      <div className="aa-chart-card">
        <div className="aa-block-head">
          <div className="aa-block-title">Что я решаю поменять</div>
          <span className="aa-quiet">выбираете вы · можно ничего</span>
        </div>
        <div className="aa-col">
          {S.adjustments.map((a, i) => (
            <button type="button" key={i} className={'aa-checkline' + (picked.includes(i) ? ' is-on' : '')} onClick={() => toggle(i)}>
              <span className="aa-checkbox" />
              <span className="aa-sr-text">{a}</span>
            </button>
          ))}
        </div>
        <div className="aa-actions" style={{ marginTop: 12 }}>
          <span className="aa-quiet">{picked.length === 0 ? 'Ничего не выбрано — это нормальный итог.' : 'Выбрано: ' + picked.length}</span>
          <button type="button" className="aa-btn aa-btn-primary" onClick={() => {}}>сохранить обзор</button>
        </div>
      </div>

      <div className="aa-warn-note">
        <b style={{ color: 'var(--fg1)' }}>Отношение к остальному.</b> Обзор не заменяет ни Дом, ни GTD-недельный обзор:
        Дом показывает 1–3 сигнала сейчас, обзор собирает свидетельства за период, GTD решает, что делать дальше.
        Пересечение сознательно оставлено открытым.
      </div>
    </div>
  );
}

Object.assign(window, { AATradeoffView, AASystemReview, AAImportance });
