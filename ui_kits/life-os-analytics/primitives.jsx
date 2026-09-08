/* global React */
/* Adaptive Analytics primitives. AA-prefixed to stay clear of the kit namespace. */
const { useState: useStateAA } = React;

/* narrow=true renders a compact bottom sheet instead of the desktop popover. */
function AAProvenance({ prov, label, narrow }) {
  const [open, setOpen] = useStateAA(false);
  if (!prov) return null;
  const rows = (
    <React.Fragment>
      <span className="aa-prov-row"><span className="aa-prov-key">источник</span><span className="aa-prov-v">{prov.source}</span></span>
      <span className="aa-prov-row"><span className="aa-prov-key">основание</span><span className="aa-prov-v">{prov.basis}</span></span>
      <span className="aa-prov-row"><span className="aa-prov-key">когда</span><span className="aa-prov-v">{prov.when}</span></span>
      <span className="aa-prov-row"><span className="aa-prov-key">как</span><span className="aa-prov-v">{prov.how}</span></span>
    </React.Fragment>
  );
  return (
    <span className="aa-prov">
      <button type="button" className={'aa-prov-chip' + (open ? ' is-on' : '')} onClick={() => setOpen(o => !o)}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        {label || 'источник'}
      </button>
      {open && !narrow && (
        <span className="aa-prov-pop" onClick={e => e.stopPropagation()}>{rows}</span>
      )}
      {open && narrow && (
        <span>
          <span className="aa-sheet-scrim" onClick={() => setOpen(false)} />
          <span className="aa-sheet" role="dialog" aria-label="Откуда это значение">
            <span className="aa-sheet-grip" />
            <span className="aa-sheet-title">Откуда это значение</span>
            <span style={{ display: 'grid' }}>{rows}</span>
            <span className="aa-quiet" style={{ display: 'block', marginTop: 10 }}>Полная история — на экране показателя.</span>
          </span>
        </span>
      )}
    </span>
  );
}

function AASignalCard({ signal, state, onOpen, onDismiss, narrow, variant }) {
  const st = state || signal.kind || 'normal';
  const stakes = signal.stakes && st !== 'resolved';
  const cls = 'aa-signal is-' + st + (stakes ? ' is-stakes' : '');
  const resolved = st === 'resolved';

  /* inline: one row inside a domain page — same semantics, no title block */
  if (variant === 'inline') {
    return (
      <div className={'aa-inline-signal' + (stakes ? ' is-stakes' : '')}>
        <span className="aa-signal-dot" />
        <span style={{ flex: 1 }}>{signal.title}{signal.magnitude ? ' · ' + signal.magnitude : ''}</span>
        <AAProvenance prov={signal.prov} narrow={narrow} />
        {onOpen && <button type="button" className="aa-link" onClick={onOpen}>контекст</button>}
      </div>
    );
  }
  return (
    <div className={cls}>
      <div className="aa-signal-top">
        <span className="aa-signal-dot" />
        <span className="aa-signal-domain">{signal.domain}</span>
        {st === 'stale' && <span className="aa-tag" data-kind="maybe">данные устарели</span>}
        {st === 'partial' && <span className="aa-tag" data-kind="maybe">частичные данные</span>}
        {resolved && <span className="aa-tag" data-kind="observed">просмотрено</span>}
      </div>
      <div className="aa-signal-title">{signal.title}</div>
      {!resolved && (signal.from || signal.to) && (
        <div className="aa-signal-body">
          <span className="aa-delta-strike">{signal.from}</span>
          <span style={{ color: 'var(--fg4)' }}> → </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg1)' }}>{signal.to}</span>
          {signal.magnitude && (
            <span className="aa-signal-mag">{signal.magnitude}</span>
          )}
        </div>
      )}
      {!resolved && signal.body && <div className="aa-signal-body">{signal.body}</div>}
      <div className="aa-signal-foot">
        <span className="aa-signal-ts">{st === 'stale' ? 'обновлено 9 дней назад' : signal.ts}</span>
        <AAProvenance prov={signal.prov} narrow={narrow} />
        {!resolved && <button type="button" className="aa-link" onClick={onOpen}>посмотреть контекст</button>}
        {!resolved && onDismiss && <button type="button" className="aa-link" style={{ color: 'var(--fg4)' }} onClick={onDismiss}>скрыть</button>}
      </div>
    </div>
  );
}

/* Facts side by side. SAME LAYOUT as AADelta, deliberately NOT the same component:
   these cells are stored facts (baseline, intervention, window, target…), never
   operands of a difference. Nothing here accepts delta/desire. */
function AAFacts({ cells }) {
  return (
    <div className="aa-facts">
      {cells.map((c, i) => (
        <div key={i} className={'aa-delta-cell' + (c.estimate ? ' is-estimate' : '') + (c.empty ? ' is-empty' : '')}>
          <span className="aa-delta-lab">{c.label}</span>
          <span className="aa-delta-val">{c.value}</span>
          {c.sub && <span className="aa-delta-sub">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/* Expected vs Actual — a DIFFERENCE between two comparable values.
   Sign is always explicit; desirability is a separate prop, so a "+" is never
   automatically green. Do not use this for unrelated facts — use AAFacts. */
function AADelta({ cells }) {
  return (
    <div className="aa-delta">
      {cells.map((c, i) => (
        <div key={i} className={'aa-delta-cell' + (c.delta ? ' is-delta' : '') + (c.estimate ? ' is-estimate' : '') + (c.empty ? ' is-empty' : '')}
             data-desire={c.desire || undefined}>
          <span className="aa-delta-lab">{c.label}</span>
          <span className="aa-delta-val">{c.value}</span>
          {c.sub && <span className="aa-delta-sub">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/* Layered history chart: actual line, typical baseline, expectation versions,
   forecast continuation, semantic event markers. Layers toggle on demand. */
function AAChart({ data, layers, narrow }) {
  const W = narrow ? 340 : 780, H = narrow ? 170 : 230;
  const padL = 44, padR = 14, padT = 14, padB = 26;
  const pts = data.series;
  const maxV = Math.max(data.forecast, data.expected, ...pts) * 1.06;
  const x = i => padL + (i / (pts.length - 1 + 4)) * (W - padL - padR);
  const y = v => H - padB - (v / maxV) * (H - padT - padB);
  const line = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const fcX = x(pts.length - 1 + 4);
  const money = v => '₴' + Math.round(v / 1000) + 'k';
  return (
    <svg className="aa-chart-svg" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="История значения">
      {[0, 0.5, 1].map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(maxV * t)} y2={y(maxV * t)} stroke="var(--border)" strokeWidth="1" />
          <text className="aa-tick" x={padL - 8} y={y(maxV * t) + 3} textAnchor="end">{money(maxV * t)}</text>
        </g>
      ))}

      {layers.typical && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(data.typical)} y2={y(data.typical)} stroke="var(--fg4)" strokeWidth="1.5" strokeDasharray="1 4" />
          <text className="aa-annot-lab" x={W - padR} y={y(data.typical) - 6} textAnchor="end">типично · {money(data.typical)}</text>
        </g>
      )}

      {layers.expect && data.expectations.map((e, i) => {
        const x1 = x(i === 0 ? 0 : (i === 1 ? 5 : 10));
        const x2 = x(i === 0 ? 5 : (i === 1 ? 10 : pts.length - 1 + 4));
        return (
          <g key={i}>
            <line x1={x1} x2={x2} y1={y(e.value)} y2={y(e.value)} stroke="var(--fg3)" strokeWidth="1.5" strokeDasharray="7 4" opacity={0.55 + i * 0.2} />
            {!narrow && <text className="aa-annot-lab" x={x1 + 4} y={y(e.value) - 6}>ожидание {money(e.value)} · {e.when}</text>}
          </g>
        );
      })}

      {layers.forecast && (
        <g>
          <path d={'M' + x(pts.length - 1) + ' ' + y(pts[pts.length - 1]) + ' L' + fcX + ' ' + y(data.forecast)}
                stroke="var(--fg3)" strokeWidth="2" strokeDasharray="2 3" fill="none" />
          <circle cx={fcX} cy={y(data.forecast)} r="3.5" fill="var(--bg-elev-1)" stroke="var(--fg3)" strokeWidth="2" />
          <text className="aa-annot-lab" x={fcX} y={y(data.forecast) - 9} textAnchor="end">прогноз {money(data.forecast)}</text>
        </g>
      )}

      <path d={line} stroke="var(--primary)" strokeWidth="2" fill="none" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3.5" fill="var(--primary)" />
      {!narrow && <text className="aa-annot-lab" x={x(pts.length - 1) + 8} y={y(pts[pts.length - 1]) + 4}>факт {money(pts[pts.length - 1])}</text>}

      {layers.events && data.events.map((ev, i) => (
        <g key={i}>
          <line x1={x(ev.at)} x2={x(ev.at)} y1={padT} y2={H - padB} stroke="var(--border-s)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={x(ev.at)} cy={H - padB} r="2.5" fill="var(--fg4)" />
          {!narrow && <text className="aa-annot-lab" x={x(ev.at)} y={padT - 3} textAnchor="middle">{ev.label}</text>}
        </g>
      ))}

      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--border-s)" strokeWidth="1" />
      <text className="aa-tick" x={padL} y={H - 8}>1 авг</text>
      <text className="aa-tick" x={x(pts.length - 1)} y={H - 8} textAnchor="middle">28 авг</text>
      <text className="aa-tick" x={W - padR} y={H - 8} textAnchor="end">31 авг</text>
    </svg>
  );
}

function AAChartLayers({ layers, onToggle }) {
  const items = [
    { key: 'expect', label: 'ожидания', color: 'var(--fg3)', dash: '7 4' },
    { key: 'forecast', label: 'прогноз', color: 'var(--fg3)', dash: '2 3' },
    { key: 'typical', label: 'типично', color: 'var(--fg4)', dash: '1 3' },
    { key: 'events', label: 'события', color: 'var(--border-s)', dash: '2 2' }
  ];
  return (
    <div className="aa-layers">
      {items.map(it => (
        <button key={it.key} type="button" className={'aa-layer' + (layers[it.key] ? ' is-on' : '')} onClick={() => onToggle(it.key)}>
          <span className="aa-layer-key" style={{ borderTopColor: it.color, borderTopStyle: it.key === 'typical' ? 'dotted' : 'dashed' }} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function AAHistoryList({ rows }) {
  return (
    <div className="aa-hist">
      {rows.map((r, i) => (
        <div className="aa-hist-row" key={i}>
          <span className="aa-hist-when">{r.when}</span>
          <span className="aa-hist-what" dangerouslySetInnerHTML={{ __html: r.what }} />
          <span className="aa-tag" data-kind={r.prov === 'Наблюдение системы' ? 'observed' : (r.prov === 'Выведено Life OS' ? 'mine' : 'maybe')}>{r.prov}</span>
        </div>
      ))}
    </div>
  );
}

/* Epistemic tag with an explicit menu: observation / my interpretation / possible factor / unknown / remove. */
const AA_KINDS = [
  ['observed', 'наблюдение', 'зафиксировано системой или мной как факт'],
  ['mine', 'моя трактовка', 'как я это понимаю'],
  ['maybe', 'возможный фактор', 'могло повлиять, не уверен'],
  ['unknown', 'неизвестно', 'причина не установлена']
];
function AAFactorTag({ kind, onChange, onRemove }) {
  const [open, setOpen] = useStateAA(false);
  const label = (AA_KINDS.find(k => k[0] === kind) || AA_KINDS[3])[1];
  return (
    <span className="aa-tag-wrap">
      <button type="button" className={'aa-tag'} data-kind={kind} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {label} ▾
      </button>
      {open && (
        <span className="aa-menu" role="menu">
          {AA_KINDS.map(([k, lab, help]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === kind} className={'aa-menu-item' + (k === kind ? ' is-on' : '')}
                    onClick={() => { onChange(k); setOpen(false); }}>
              <span>{lab}</span><span className="aa-quiet" style={{ fontSize: 10 }}>{help}</span>
            </button>
          ))}
          {onRemove && <span className="aa-menu-sep" />}
          {onRemove && <button type="button" role="menuitem" className="aa-menu-item is-danger" onClick={() => { setOpen(false); onRemove(); }}>убрать фактор</button>}
        </span>
      )}
    </span>
  );
}

/* One-line contextual data-quality strip; expands for detail. */
function AAQualityStrip({ items, detail }) {
  const [open, setOpen] = useStateAA(false);
  return (
    <div>
      <div className="aa-quality">
        {items.map((it, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="aa-quality-sep">·</span>}
            <span className="aa-quality-item"><b>{it[0]}</b> {it[1]}</span>
          </React.Fragment>
        ))}
        <button type="button" className="aa-link aa-quality-more" style={{ fontSize: 11 }} onClick={() => setOpen(o => !o)}>{open ? 'свернуть' : 'подробнее'}</button>
      </div>
      {open && <div className="aa-quality-detail">{detail}</div>}
    </div>
  );
}

Object.assign(window, { AAProvenance, AASignalCard, AADelta, AAFacts, AAChart, AAChartLayers, AAHistoryList, AAFactorTag, AAQualityStrip });
