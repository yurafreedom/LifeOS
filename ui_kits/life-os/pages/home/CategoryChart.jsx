/* global React */
const { useState: useStCat, useContext: useCtxCat, useMemo: useMemoCat } = React;

/* CategoryChart — horizontal width-percent bars (NOT a chart-library task).

   Layout per row:
     · icon (--icon-sm) · category name · amount (mono, right-aligned)
     · bar 3px tall underneath, width relative to LARGEST visible row.

   Filter chip: month (default) | 30 days — for Sprint 2 both filters
   point at seed (visual control works, no real 30-day aggregation yet).

   Truncation: top 6, remaining collapse to "+ N других" row using sum.

   Orange-stakes rule:
     · Any row where amount / capsByCat[catId] ≥ 0.80 qualifies.
     · Exactly ONE row gets the orange treatment per chart — the one
       with the highest utilization. Others stay blue.
*/
function CategoryChart({ monthData, days30Data, capsByCat, locale, onEmptyCta, allHidden, allHiddenHint }) {
  const { t } = useCtxCat(window.LifeLocaleContext);
  const [window_, setWindow] = useStCat('month');
  const I = window.LIcons;

  const raw = window_ === 'month' ? monthData : days30Data;

  /* ── Sprint 3B · extreme empty state: every category hidden ──── */
  if (allHidden) {
    return (
      <window.ChartCard
        eyebrow={t('chart_categories_title')}
        total={null}
        controls={
          <FilterChips value={window_} setValue={setWindow}
                       a={{ id: 'month', label: t('chart_filter_month') }}
                       b={{ id: '30d',   label: t('chart_filter_30') }} />
        }>
        <div className="chart-empty">
          <div className="chart-empty-msg">{allHiddenHint || t('chart_empty_cat')}</div>
        </div>
      </window.ChartCard>
    );
  }

  /* ── 0-data empty state ──────────────────────────────── */
  if (!raw || raw.length === 0) {
    return (
      <window.ChartCard
        eyebrow={t('chart_categories_title')}
        total={null}
        controls={
          <FilterChips value={window_} setValue={setWindow}
                       a={{ id: 'month', label: t('chart_filter_month') }}
                       b={{ id: '30d',   label: t('chart_filter_30') }} />
        }>
        <div className="chart-empty">
          <div className="chart-empty-msg">{t('chart_empty_cat')}</div>
        </div>
      </window.ChartCard>
    );
  }

  /* ── sort descending, take top 6 + "others" ──────────── */
  const sorted = raw.slice().sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const othersSum = rest.reduce((s, r) => s + r.amount, 0);

  /* visible rows include the others-aggregate row if applicable */
  const visible = top.map(r => ({ ...r, isOthers: false }));
  if (rest.length > 0) {
    visible.push({
      catId: '__others',
      amount: othersSum,
      othersCount: rest.length,
      isOthers: true,
    });
  }

  const maxVisible = Math.max(...visible.map(r => r.amount), 1);
  const total = visible.reduce((s, r) => s + r.amount, 0);

  /* ── orange-stakes pick: highest-utilization row ≥ 80% (top rows only) */
  const caps = capsByCat || {};
  let orangeId = null;
  let orangeUtil = -1;
  top.forEach(r => {
    const cap = caps[r.catId];
    if (!cap || cap <= 0) return;
    const util = r.amount / cap;
    if (util >= 0.80 && util > orangeUtil) {
      orangeUtil = util;
      orangeId = r.catId;
    }
  });

  const cats = window.LifeCategories || [];
  const catLookup = {};
  cats.forEach(c => { catLookup[c.id] = c; });

  const fmt = (n) => '$' + Math.round(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  return (
    <window.ChartCard
      eyebrow={t('chart_categories_title')}
      total={fmt(total)}
      controls={
        <FilterChips value={window_} setValue={setWindow}
                     a={{ id: 'month', label: t('chart_filter_month') }}
                     b={{ id: '30d',   label: t('chart_filter_30') }} />
      }>
      <div className="cat-list">
        {visible.map(row => {
          const isOrange = !row.isOthers && row.catId === orangeId;
          const cat = catLookup[row.catId];
          const name = row.isOthers
            ? t('chart_others', row.othersCount)
            : (cat ? cat.name[locale] || cat.name.ru : row.catId);
          const Icon = row.isOthers
            ? (I && I.moreHorizontal)
            : (cat && I && I[cat.icon]);
          const pct = (row.amount / maxVisible) * 100;
          return (
            <div key={row.catId}
                 className={"cat-row" + (isOrange ? ' is-stakes' : '') + (row.isOthers ? ' is-others' : '')}>
              <div className="cat-row-head">
                <span className="cat-row-icon">
                  {Icon ? <Icon size={12} /> : <span className="cat-row-icon-dot" />}
                </span>
                <span className="cat-row-name">{name}</span>
                <span className="cat-row-amt mono">{fmt(row.amount)}</span>
              </div>
              <div className="cat-row-bar">
                <div className="cat-row-bar-fill" style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </window.ChartCard>
  );
}

function FilterChips({ value, setValue, a, b }) {
  return (
    <div className="chart-segctrl is-quiet">
      <button type="button"
              className={"chart-segctrl-btn mono" + (value === a.id ? ' is-on' : '')}
              onClick={() => setValue(a.id)}>{a.label}</button>
      <button type="button"
              className={"chart-segctrl-btn mono" + (value === b.id ? ' is-on' : '')}
              onClick={() => setValue(b.id)}>{b.label}</button>
    </div>
  );
}

window.CategoryChart = CategoryChart;
