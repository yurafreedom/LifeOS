import React from 'react';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';
import { LifeExpenseCats } from '../data/categories.js';
import { AnalyticsContext } from '../context/AnalyticsContext.jsx';

/* global React */
const { useState: useStateMW, useContext: useCtxMW } = React;

function MoneyWidget({ logged: loggedProp }) {
  const { t, locale } = useCtxMW(LifeLocaleContext);
  const analytics = useCtxMW(AnalyticsContext);
  const cats = LifeExpenseCats;

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

  const finance = analytics?.finance?.data;
  const expectation = finance?.current_expectation?.value ?? null;
  const target = finance?.current_target ?? null;
  const actual = finance?.actual ?? null;
  const expectedAmount = expectation?.type === 'money' ? Number(expectation.num) : null;
  const actualAmount = actual?.type === 'money' ? Number(actual.num) : null;
  const comparisonPct = expectedAmount > 0 && actualAmount != null
    ? Math.min(100, (actualAmount / expectedAmount) * 100)
    : 0;

  const intlLoc = LifeStrings[locale]._intl_locale;
  const monthShort = new Date().toLocaleDateString(intlLoc, { month: 'short' }).replace('.', '');

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

  return (
    <section className="card panel">
      <div className="panel-head">
        <h3 className="panel-title">{t('money_title')}</h3>
        <div className="panel-head-right">
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
          <span className="mono money-budget-lab">Факт / ожидание · {monthShort.toLowerCase()}</span>
          <span className="mono money-budget-val">
            {actualAmount == null ? 'нет данных' : `₴${actualAmount.toLocaleString()}`} / {expectedAmount == null ? 'ожидание не задавалось' : `₴${expectedAmount.toLocaleString()}`}
          </span>
        </div>
        <div className="money-budget-track">
          <div className="money-budget-fill" style={{ width: comparisonPct + '%' }} />
        </div>
        <div className="mono money-budget-hint">Ожидание не является целью.</div>
        <div className="mono money-budget-hint">
          {target?.is_explicitly_absent ? 'цель на месяц не задавалась' : target ? 'цель хранится отдельно' : 'факт цели отсутствует'}
        </div>
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

export { MoneyWidget };
