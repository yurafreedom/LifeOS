/* global React */
const { useContext: useCtxBM, useMemo: useMemoBM } = React;

/* Body metrics card. Inline editable height + weight, last-3 weigh-in
   sparkline (mock data). Notes field at the bottom. */
function BodyMetricsCard({ data, onChange }) {
  const { t } = useCtxBM(window.LifeLocaleContext);
  const Field = window.EditableField;

  const points = useMemoBM(() => {
    const series = data.history || [];
    if (series.length < 2) return null;
    const vals = series.map(s => s.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const W = 160, H = 32;
    return series.map((s, i) => {
      const x = (i / (series.length - 1)) * (W - 4) + 2;
      const y = H - 4 - ((s.weight - min) / range) * (H - 8);
      return { x, y, label: s.date, weight: s.weight };
    });
  }, [data.history]);

  return (
    <section className="pc-card">
      <header className="pc-head">
        <h3 className="pc-title">{t('pc_body')}</h3>
      </header>
      <div className="pc-body pc-grid-2">
        <div className="pc-row">
          <div className="pc-label mono">{t('pc_body_height')}</div>
          <Field value={data.heightCm}
                 type="number"
                 mono
                 suffix={t('pc_body_unit_cm')}
                 onChange={(v) => onChange({ heightCm: v })} />
        </div>
        <div className="pc-row">
          <div className="pc-label mono">{t('pc_body_weight')}</div>
          <Field value={data.weightKg}
                 type="number"
                 mono
                 suffix={t('pc_body_unit_kg')}
                 onChange={(v) => onChange({ weightKg: v })} />
        </div>
        <div className="pc-row pc-row-wide">
          <div className="pc-label mono">{t('pc_body_history')}</div>
          {points ? (
            <div className="pc-sparkline">
              <svg width="180" height="40" viewBox="0 0 180 40">
                <polyline
                  points={points.map(p => p.x + ',' + p.y).join(' ')}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3 : 2}
                          fill={i === points.length - 1 ? 'var(--primary-l)' : 'var(--primary)'} />
                ))}
              </svg>
              <div className="pc-sparkline-labels mono">
                {points.map((p, i) => (
                  <span key={i} className={"pc-sparkline-label" + (i === points.length - 1 ? " is-last" : "")}>
                    {p.label} · {p.weight}{t('pc_body_unit_kg')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="pc-empty-inline">—</div>
          )}
        </div>
        <div className="pc-row pc-row-wide">
          <div className="pc-label mono">{t('pc_body_notes')}</div>
          <Field value={data.notes}
                 placeholder={t('pc_body_notes_ph')}
                 multiline
                 onChange={(v) => onChange({ notes: v })} />
        </div>
      </div>
    </section>
  );
}

window.BodyMetricsCard = BodyMetricsCard;
