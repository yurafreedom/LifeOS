/* global React */
const { useState: useStateFin, useContext: useCtxFin, useMemo: useMemoFin } = React;

/* Sprint 3B · FinancesPage — full surface (replaces the v1 wrapper
   that just rendered <MoneyWidget/>). Sources transactions from the
   central state tree, exposes the per-transaction eye toggle, and
   shows totals that respect category overrides.

   Composition:
     header           page-head + tx count + in-totals chip
     budget summary   overall monthly utilization (cap from seed,
                      spent from state, hidden amount split out)
     logger row       amount + category select + log
     filter chips     all · visible · hidden
     transaction list grouped by date, each row with EyeToggle */
function FinancesPage({ emptyMode }) {
  const { t, locale } = useCtxFin(window.LifeLocaleContext);
  const data = useCtxFin(window.LifeDataContext);
  const I = window.LIcons;
  const F = window.LifeFinance;

  const state    = data.state;
  const txAll    = state.transactions || [];
  const txList   = emptyMode ? [] : txAll;
  const overrides = state.categoryOverrides || {};

  const expenseCats = window.LifeExpenseCats || [];
  const catLookup = useMemoFin(() => {
    const m = {};
    (window.LifeCategories || []).forEach(c => { m[c.id] = c; });
    return m;
  }, []);

  /* ── derived totals ───────────────────────────────────── */
  const inTotals    = F.sumIncluded(txList, overrides);
  const hidden      = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : (+x.amount || 0)), 0);
  const visibleCount = txList.filter(x => F.isIncluded(x, overrides)).length;

  const seed = window.LifeDashSeed || {};
  const cap  = (seed.budget && seed.budget.capUsd) || 4000;
  const pct  = cap > 0 ? Math.min(100, (inTotals / cap) * 100) : 0;
  const warn = pct >= 80 && pct <= 100;
  const over = inTotals > cap;

  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, { month: 'short' }).replace('.', '');
  const fmt = (n) => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /* ── logger form ──────────────────────────────────────── */
  const [amount, setAmount] = useStateFin('');
  const [catId, setCatId]   = useStateFin('groceries');
  function logIt(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    data.addTransaction({
      amount: n,
      category_id: catId,
      date: new Date().toISOString().slice(0, 10),
      description: catLookup[catId] ? catLookup[catId].name[locale] : catId,
      source: 'manual',
    });
    setAmount('');
  }

  /* ── filter chips ─────────────────────────────────────── */
  const [filter, setFilter] = useStateFin('all');
  const filters = [
    { id: 'all',     label: t('fin_filter_all') },
    { id: 'visible', label: t('fin_filter_visible') },
    { id: 'hidden',  label: t('fin_filter_hidden') },
  ];
  const filtered = useMemoFin(() => {
    if (filter === 'visible') return txList.filter(x => F.isIncluded(x, overrides));
    if (filter === 'hidden')  return txList.filter(x => !F.isIncluded(x, overrides));
    return txList;
  }, [txList, overrides, filter]);

  /* sort newest-first by date (then by id as tiebreaker so logged-now
     entries land on top before their `date` clock-ticks past). */
  const sorted = useMemoFin(() =>
    filtered.slice().sort((a, b) => {
      const ad = String(a.date || ''), bd = String(b.date || '');
      if (ad !== bd) return bd.localeCompare(ad);
      return String(b.id).localeCompare(String(a.id));
    }), [filtered]);

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(intlLoc, { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="page fin-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('money_title')}</h2>
          <div className="page-sub mono">
            {t('fin_subtitle', txList.length, '$' + fmt(inTotals))} · {t('fin_period', monthShort)}
          </div>
        </div>
      </header>

      {/* budget summary */}
      <section className={"card panel fin-summary" + (over ? ' is-over' : warn ? ' is-warn' : '')}>
        <div className="fin-summary-grid">
          <div className="fin-summary-cell">
            <div className="fin-summary-eyebrow mono">{t('fin_total_in')}</div>
            <div className="fin-summary-val mono">${fmt(inTotals)}</div>
            <div className="fin-summary-meta mono">{t('fin_budget_val', fmt(inTotals), fmt(cap))}</div>
          </div>
          <div className="fin-summary-cell">
            <div className="fin-summary-eyebrow mono">{t('fin_total_hidden')}</div>
            <div className={"fin-summary-val mono fin-summary-val-quiet"}>${fmt(hidden)}</div>
            <div className="fin-summary-meta mono">
              {txList.length - visibleCount}/{txList.length} · {t.pl('pl_tx', txList.length - visibleCount)}
            </div>
          </div>
          <div className="fin-summary-bar-wrap">
            <div className="fin-summary-bar-track">
              <div className={"fin-summary-bar-fill" + (over ? ' is-over' : warn ? ' is-warn' : '')}
                   style={{ width: pct + '%' }} />
            </div>
            <div className="fin-summary-bar-meta mono">
              {Math.round(pct)}% · {t('fin_budget_label', monthShort.toLowerCase())}
            </div>
          </div>
        </div>

        <form className="fin-logger" onSubmit={logIt}>
          <div className="money-input-wrap fin-logger-amount">
            <span className="money-prefix mono">$</span>
            <input
              type="text"
              className="money-input mono"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('fin_amt_ph')}
              inputMode="decimal"
            />
          </div>
          <select className="money-bucket mono fin-logger-cat" value={catId} onChange={e => setCatId(e.target.value)}>
            {expenseCats.map(c => (
              <option key={c.id} value={c.id}>{c.name[locale]}</option>
            ))}
          </select>
          <button className="money-log fin-logger-go" type="submit">{t('fin_log')}</button>
        </form>
      </section>

      {/* filter chips */}
      <div className="tasks-toolbar fin-toolbar">
        <div className="tasks-chips">
          {filters.map(f => {
            const count = f.id === 'all' ? txList.length
                        : f.id === 'visible' ? visibleCount
                        : (txList.length - visibleCount);
            return (
              <button key={f.id}
                      className={"tasks-chip" + (filter === f.id ? " is-on" : "")}
                      onClick={() => setFilter(f.id)}>
                {f.label} <span className="tasks-chip-count mono">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* transaction list */}
      <section className="card panel fin-tx-card">
        <div className="panel-head">
          <h3 className="panel-title">{t('fin_section_recent')}</h3>
          <div className="panel-head-right">
            <span className="mono panel-meta">{sorted.length} · {t.pl('pl_tx', sorted.length)}</span>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state">{t('fin_empty_tx')}</div>
        ) : (
          <ul className="fin-tx-list">
            {sorted.map(tx => {
              const cat = catLookup[tx.category_id];
              const Icon = cat && I[cat.icon];
              const included = F.isIncluded(tx, overrides);
              const catHidden = overrides[tx.category_id] && overrides[tx.category_id].included_in_totals === false;
              const txOff = tx.included_in_totals === false;
              const eyeTitle = txOff ? t('eye_include_tip') : t('eye_exclude_tip');
              return (
                <li key={tx.id} className={"fin-tx" + (included ? '' : ' is-excluded')}>
                  <span className={"fin-tx-icon " + (cat ? window.LifeCatTintClass[cat.tint] : '')}>
                    {Icon ? <Icon size={14} /> : <span className="fin-tx-icon-dot" />}
                  </span>
                  <div className="fin-tx-where">
                    <div className="fin-tx-where-top">
                      <span className="fin-tx-cat">{cat ? cat.name[locale] : tx.category_id}</span>
                      {catHidden && (
                        <span className="fin-tx-cat-chip mono" title={t('fin_cat_off_chip')}>
                          {t('fin_cat_off_chip')}
                        </span>
                      )}
                    </div>
                    <span className="fin-tx-desc">{tx.description}</span>
                  </div>
                  <window.EyeToggle
                    included={!txOff}
                    onToggle={() => data.toggleTransactionInclusion(tx.id)}
                    title={eyeTitle}
                    ariaLabel={eyeTitle}
                    size={14}
                  />
                  <span className="fin-tx-amt mono">${fmt(tx.amount)}</span>
                  <span className="fin-tx-meta mono">{(tx.source || '')} · {fmtDate(tx.date)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

window.FinancesPage = FinancesPage;
