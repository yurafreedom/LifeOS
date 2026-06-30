/* global React */
/* pages/medications/GlobalJournal.jsx · Sprint 3A Batch 4
 *
 * Global pharm-notes feed for /medications · ЖУРНАЛ view. Combines
 * pharmNotes[*] across every medication, sorted reverse-chronological,
 * with per-med chip filter, polarity filter (all / + only / − only),
 * and full-text search. Hover row to edit/delete (same UX as the
 * per-med PharmNotes component). */

const { useState: useStateGJ, useContext: useCtxGJ, useMemo: useMemoGJ } = React;

function GlobalJournal() {
  const data = useCtxGJ(window.LifeDataContext);
  const { t, locale } = useCtxGJ(window.LifeLocaleContext);

  const meds = data.state.medications || [];
  const pharm = data.state.pharmNotes || {};

  /* default: all meds selected (empty set = all in our UX convention) */
  const [selectedMeds, setSelectedMeds] = useStateGJ([]);
  const [polarity, setPolarity]         = useStateGJ('all');
  const [search, setSearch]             = useStateGJ('');

  function toggleMed(id) {
    setSelectedMeds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const allMedsActive = meds.filter(m => m.status !== 'archived');

  const allNotes = useMemoGJ(() => {
    const rows = [];
    for (const med of allMedsActive) {
      const list = pharm[med.id] || [];
      const medName = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
      for (const n of list) rows.push({ ...n, medId: med.id, medName });
    }
    rows.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return tb - ta;
    });
    return rows;
  }, [pharm, allMedsActive, locale]);

  const filtered = useMemoGJ(() => {
    return allNotes.filter(n => {
      if (selectedMeds.length > 0 && !selectedMeds.includes(n.medId)) return false;
      if (polarity === '+' && n.polarity !== '+') return false;
      if (polarity === '-' && n.polarity !== '-') return false;
      if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allNotes, selectedMeds, polarity, search]);

  const intlLoc = (window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale) || 'ru-RU';

  return (
    <div className="gj">
      <div className="gj-filters">
        <div className="gj-chip-row">
          <button className={"meds-filter-chip mono" + (selectedMeds.length === 0 ? " is-on" : "")}
                  onClick={() => setSelectedMeds([])}>
            {t('meds_filter_all')}
          </button>
          {allMedsActive.map(med => {
            const name = med['name_' + (locale === 'uk' ? 'ua' : 'ru')] || med.name_ru;
            return (
              <button key={med.id}
                      className={"meds-filter-chip mono" + (selectedMeds.includes(med.id) ? " is-on" : "")}
                      onClick={() => toggleMed(med.id)}>
                {name}
              </button>
            );
          })}
        </div>

        <div className="gj-controls">
          <div className="gj-pol-toggle">
            <button className={"gj-pol mono" + (polarity === 'all' ? " is-on" : "")} onClick={() => setPolarity('all')}>{t('gj_filter_all')}</button>
            <button className={"gj-pol pn-pol-plus mono" + (polarity === '+' ? " is-on" : "")} onClick={() => setPolarity('+')}>{t('gj_filter_plus')}</button>
            <button className={"gj-pol pn-pol-minus mono" + (polarity === '-' ? " is-on" : "")} onClick={() => setPolarity('-')}>{t('gj_filter_minus')}</button>
          </div>
          <input type="text" className="tdm-input gj-search"
                 placeholder={t('gj_search_ph')}
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <ul className="gj-list pn-list">
        {filtered.length === 0 && (
          <li className="pn-empty mono">{t('gj_empty')}</li>
        )}
        {filtered.map(n => {
          const when = new Date(n.date).toLocaleDateString(intlLoc, { day: '2-digit', month: '2-digit' });
          return (
            <li key={n.medId + '/' + n.id}
                className={"pn-row pn-row-" + (n.polarity === '+' ? 'plus' : 'minus')}>
              <span className={"pn-row-mark pn-row-mark-" + (n.polarity === '+' ? 'plus' : 'minus')}>
                {n.polarity === '+' ? '+' : '−'}
              </span>
              <span className="pn-row-date mono">{when}</span>
              <span className="gj-row-med mono">{n.medName}</span>
              <span className="pn-row-text">{n.text}</span>
              <div className="pn-row-actions">
                <button className="pn-row-act pn-row-act-del mono"
                        onClick={() => data.deletePharmNote(n.medId, n.id)}>
                  {t('pn_delete')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

window.GlobalJournal = GlobalJournal;
