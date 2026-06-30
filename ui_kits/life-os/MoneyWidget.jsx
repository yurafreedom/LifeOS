/* global React */
const { useState: useStateMW, useContext: useCtxMW } = React;

function MoneyWidget({ logged: loggedProp }) {
  const { t, locale } = useCtxMW(window.LifeLocaleContext);
  const I = window.LIcons;
  const cats = window.LifeExpenseCats;

  const [amount, setAmount] = useStateMW('42.00');
  const [catId, setCatId]   = useStateMW('groceries');
  const [loggedState, setLogged] = useStateMW([
    { id: 1, amount: 4.20,   cat: 'restaurants', at: '08:14' },
    { id: 2, amount: 32.50,  cat: 'groceries',   at: '12:02' },
    { id: 3, amount: 14.00,  cat: 'restaurants', at: '13:31' },
    { id: 4, amount: 18.00,  cat: 'restaurants', at: '19:48' },
    { id: 5, amount: 76.40,  cat: 'groceries',   at: 'ПН'   },
    { id: 6, amount: 98.00,  cat: 'restaurants', at: 'СБ'   },
    { id: 7, amount: 115.00, cat: 'restaurants', at: 'ПТ'   },
  ]);
  const logged = loggedProp != null ? loggedProp : loggedState;

  const isEmpty = logged.length === 0;

  const spent  = logged.reduce((s, l) => s + l.amount, 0);
  const budget = 300;
  const pct    = Math.min(100, (spent / budget) * 100);
  const warn   = pct >= 80;
  const over   = spent > budget;

  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, { month: 'short' }).replace('.', '');

  /* days left in current month */
  const today = new Date();
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();

  function catName(id) {
    const c = cats.find(x => x.id === id);
    return c ? c.name[locale] : id;
  }

  function logIt(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const at = new Date().toTimeString().slice(0, 5);
    setLogged([{ id: Date.now(), amount: n, cat: catId, at }, ...logged]);
    setAmount('');
  }

  const trackedCat = 'restaurants';
  const trackedSpent = logged.filter(l => l.cat === trackedCat).reduce((s, l) => s + l.amount, 0);
  const trackedPct = Math.min(100, (trackedSpent / budget) * 100);
  const trackedWarn = trackedPct >= 80;
  const trackedOver = trackedSpent > budget;

  return (
    <section className={"card panel" + (trackedWarn ? " is-stakes" : "")}>
      <div className="panel-head">
        <h3 className="panel-title">{t('money_title')}</h3>
        <div className="panel-head-right">
          {trackedWarn && !trackedOver && <span className="mono money-warn-badge">{t('money_warn_badge')}</span>}
          {trackedOver &&                  <span className="mono money-over-badge">{t('money_over_badge')}</span>}
          <span className="mono panel-meta">{t('money_period_currency', monthShort)}</span>
        </div>
      </div>

      <form className="money-input-row" onSubmit={logIt}>
        <div className="money-input-wrap">
          <span className="money-prefix mono">$</span>
          <input
            type="text"
            className="money-input mono"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={t('money_amt_placeholder')}
            inputMode="decimal"
          />
        </div>
        <select className="money-bucket mono" value={catId} onChange={e => setCatId(e.target.value)}>
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.name[locale]}</option>
          ))}
        </select>
        <button className="money-log" type="submit">{t('money_log')}</button>
      </form>

      {isEmpty ? (
        <div className="empty-state" style={{ marginTop: 4 }}>{t('empty_money')}</div>
      ) : (
        <React.Fragment>
          <div className="money-budget">
        <div className="money-budget-head">
          <span className={"mono money-budget-lab" + (trackedWarn ? " is-stakes" : "")}>
            {t('money_budget_pre', catName(trackedCat), monthShort.toLowerCase())}
          </span>
          <span className="mono money-budget-val">${trackedSpent.toFixed(2)} / ${budget}.00</span>
        </div>
        <div className="money-budget-track">
          <div className={"money-budget-fill" + (trackedOver ? " is-over" : trackedWarn ? " is-warn" : "")}
               style={{ width: trackedPct + '%' }} />
        </div>
        {trackedWarn && !trackedOver && (
          <div className="mono money-budget-hint">{t('money_warn_hint', daysLeft, t.pl('pl_day', daysLeft))}</div>
        )}
        {trackedOver && (
          <div className="mono money-budget-hint is-over">
            {t('money_over_hint', (trackedSpent - budget).toFixed(2))}
          </div>
        )}
      </div>

      <ul className="money-list">
        {logged.slice(0, 3).map(l => (
          <li key={l.id} className="money-list-item">
            <span className="mono money-list-time">{l.at}</span>
            <span className="money-list-where">{catName(l.cat)}</span>
            <span className="mono money-list-amt">${l.amount.toFixed(2)}</span>
          </li>
        ))}
      </ul>
        </React.Fragment>
      )}
    </section>
  );
}

window.MoneyWidget = MoneyWidget;
