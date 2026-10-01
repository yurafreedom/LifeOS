import React from 'react';
import { EyeToggle } from '../components/EyeToggle.jsx';
import { PageHeader } from '../components/HeroVignette.jsx';
import { LIcons } from '../components/icons.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';
import { LifeCatTintClass, LifeCategories, LifeExpenseCats } from '../data/categories.js';
import { LifeFinance } from '../lib/finance.js';
import { FinanceDocuments } from './finances/FinanceDocuments.jsx';

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
/* JENKIN S2: Operations | Documents. The tab lives in the hash
   (#/finances/documents) so it survives reloads and can be linked. */
function readFinanceTab() {
  if (typeof window === 'undefined') return 'transactions';
  return window.location.hash.replace(/^#\/?/, '') === 'finances/documents' ? 'documents' : 'transactions';
}

function FinanceTabs({ tab, onTab, t }) {
  const tabs = [
    { id: 'transactions', label: t('fin_tab_transactions') },
    { id: 'documents', label: t('fin_tab_documents') },
  ];
  return (
    <div className="tasks-toolbar fin-tabs" role="tablist" aria-label={t('fin_tabs_label')}>
      <div className="tasks-chips">
        {tabs.map(item => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
                  className={'tasks-chip' + (tab === item.id ? ' is-on' : '')}
                  onClick={() => onTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FinancesPage({ emptyMode, onAnalytics }) {
  const { t } = useCtxFin(LifeLocaleContext);
  const [tab, setTab] = useStateFin(readFinanceTab);
  React.useEffect(() => {
    function onHash() { setTab(readFinanceTab()); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  function selectTab(next) {
    const target = next === 'documents' ? '#/finances/documents' : '#/finances';
    setTab(next);
    if (window.location.hash !== target) window.location.hash = target;
  }
  if (tab === 'documents') {
    return (
      <div className="page fin-page">
        <PageHeader title={t('money_title')} subtitle={t('fin_tab_documents')} />
        <FinanceTabs tab={tab} onTab={selectTab} t={t} />
        <FinanceDocuments />
      </div>
    );
  }
  return (
    <FinanceTransactions emptyMode={emptyMode} onAnalytics={onAnalytics}
                         tabs={<FinanceTabs tab={tab} onTab={selectTab} t={t} />} />
  );
}

function FinanceTransactions({ emptyMode, onAnalytics, tabs }) {
  const { t, locale } = useCtxFin(LifeLocaleContext);
  const data = useCtxFin(LifeDataContext);
  const I = LIcons;
  const F = LifeFinance;

  const state    = data.state;
  const txAll    = state.transactions || [];
  const txList   = emptyMode ? [] : txAll;
  const overrides = state.categoryOverrides || {};

  const expenseCats = LifeExpenseCats || [];
  const catLookup = useMemoFin(() => {
    const m = {};
    (LifeCategories || []).forEach(c => { m[c.id] = c; });
    return m;
  }, []);

  /* ── derived totals ───────────────────────────────────── */
  const inTotals    = F.sumIncluded(txList, overrides);
  const hidden      = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : (+x.amount || 0)), 0);
  const visibleCount = txList.filter(x => F.isIncluded(x, overrides)).length;

  /* JENKIN S1: no budget cap is configurable yet, so none is shown — the old
     seeded $4,000 cap made every account look budgeted. Amounts keep the
     historical "$" label: their currency is not reinterpreted here (F1). */
  const cap  = null;
  const pct  = 0;
  const warn = false;
  const over = false;

  const intlLoc = LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, { month: 'short' }).replace('.', '');
  const fmt = (n) => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /* ── logger form ──────────────────────────────────────── */
  const [amount, setAmount] = useStateFin('');
  const [catId, setCatId]   = useStateFin('groceries');
  async function logIt(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    await data.addTransaction({
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
      <PageHeader
        title={t('money_title')}
        subtitle={<>{t('fin_subtitle', txList.length, '$' + fmt(inTotals))} · {t('fin_period', monthShort)}</>}
        aside={onAnalytics ? (
          <button type="button" className="set-btn-ghost" onClick={onAnalytics}>Аналитика</button>
        ) : null}
      />

      {tabs}

      {/* budget summary */}
      <section className={"card panel fin-summary" + (over ? ' is-over' : warn ? ' is-warn' : '')}>
        <div className="fin-summary-grid">
          <div className="fin-summary-cell">
            <div className="fin-summary-eyebrow mono">{t('fin_total_in')}</div>
            <div className="fin-summary-val mono">${fmt(inTotals)}</div>
            <div className="fin-summary-meta mono">{t('fin_budget_unset')}</div>
          </div>
          <div className="fin-summary-cell">
            <div className="fin-summary-eyebrow mono">{t('fin_total_hidden')}</div>
            <div className={"fin-summary-val mono fin-summary-val-quiet"}>${fmt(hidden)}</div>
            <div className="fin-summary-meta mono">
              {txList.length - visibleCount}/{txList.length} · {t.pl('pl_tx', txList.length - visibleCount)}
            </div>
          </div>
          {cap != null && (
            <div className="fin-summary-bar-wrap">
              <div className="fin-summary-bar-track">
                <div className={"fin-summary-bar-fill" + (over ? ' is-over' : warn ? ' is-warn' : '')}
                     style={{ width: pct + '%' }} />
              </div>
              <div className="fin-summary-bar-meta mono">
                {Math.round(pct)}% · {t('fin_budget_label', monthShort.toLowerCase())}
              </div>
            </div>
          )}
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
                  <span className={"fin-tx-icon " + (cat ? LifeCatTintClass[cat.tint] : '')}>
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
                  <EyeToggle
                    included={!txOff}
                    onToggle={() => data.toggleTransactionInclusion(tx.id)}
                    title={eyeTitle}
                    ariaLabel={eyeTitle}
                    size={14}
                  />
                  <button type="button" className="set-btn-ghost" onClick={async () => {
                    const raw = window.prompt('Исправленная сумма', String(tx.amount));
                    if (raw == null || !/^\d+(?:\.\d{1,2})?$/.test(raw)) return;
                    await data.correctTransaction(tx.id, { amount: Number(raw) }, 'Исправление суммы');
                  }}>Исправить</button>
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

export { FinancesPage };
