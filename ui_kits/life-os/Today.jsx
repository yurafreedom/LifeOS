/* global React */
const { useContext: useCtxToday } = React;

function Today({ tasks }) {
  const { t, locale } = useCtxToday(window.LifeLocaleContext);
  const due = tasks.filter(x => !x.done).length;
  const done = tasks.filter(x => x.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const dateLine = new Date().toLocaleDateString(intlLoc, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="today-hero">
      <div className="today-head">
        <span className="today-eyebrow mono">{t('today_eyebrow', due, t.pl('pl_task', due))}</span>
        <span className="today-date mono">{dateLine}</span>
      </div>
      <div className="today-body">
        <div className="today-num mono">
          <span className="today-num-done">{done}</span>
          <span className="today-num-slash">/</span>
          <span className="today-num-total">{total}</span>
        </div>
        <div className="today-meta">
          <div className="today-meta-line">{t('today_meta_stakes')}</div>
          <div className="today-progress">
            <div className="today-progress-fill" style={{ width: pct + '%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.Today = Today;
