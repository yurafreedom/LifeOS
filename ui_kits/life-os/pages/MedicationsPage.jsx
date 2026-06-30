/* global React */
/* pages/MedicationsPage.jsx · Sprint 3A Batch 2 rewrite
 *
 * Three-view container for the medications surface:
 *
 *   СПИСОК   — overview grid of MedCards filtered by status chips
 *   ЖУРНАЛ   — global pharm-notes feed (Batch 4 — stub for now)
 *   ИСТОРИЯ  — dose log timeline across all meds (Batch 4 — stub)
 *
 * The previous Sprint 1 read-only list + CYP2D6 interactions table
 * has been retired. CYP2D6 data still lives in data/medications.js
 * for clinical context and may resurface in a future detail tab,
 * but per the architectural decision Life OS is not a clinical
 * decision-support tool. */

const { useState: useStateMP, useContext: useCtxMP, useEffect: useEffMP } = React;

function MedicationsPage() {
  const data   = useCtxMP(window.LifeDataContext);
  const { t, locale } = useCtxMP(window.LifeLocaleContext);
  const I = window.LIcons;

  const [view, setView]         = useStateMP('list');                // list | journal | history
  const [filter, setFilter]     = useStateMP('active');
  const [takeMed, setTakeMed]   = useStateMP(null);
  const [refillMed, setRefMed]  = useStateMP(null);
  const [configMed, setCfgMed]  = useStateMP(null);

  /* Hash-based sub-route. /medications/{id} opens MedDetailPage
     (Batch 4 — for now we render a small inline placeholder so the
     navigation contract holds). */
  const [subId, setSubId] = useStateMP(() => parseSubRoute());
  useEffMP(() => {
    function onHash() { setSubId(parseSubRoute()); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function openDetail(id) {
    window.location.hash = '#/medications/' + id;
  }
  function closeDetail() {
    window.location.hash = '#/medications';
  }

  if (subId) {
    if (window.MedDetailPage) {
      return <window.MedDetailPage medId={subId} onBack={closeDetail} />;
    }
    return (
      <div className="page meds-page">
        <button className="medc-refill mono" onClick={closeDetail}>← {t('meds_view_list')}</button>
        <div className="ph-card meds-ph">
          <div className="ph-eyebrow mono">med · {subId}</div>
          <div className="ph-body">Sprint 3A Batch 4: детальный экран препарата.</div>
        </div>
      </div>
    );
  }

  const meds = data.state.medications || [];
  const filtered = meds.filter(m => {
    if (filter === 'all') return m.status !== 'archived';
    if (filter === 'active')    return m.status === 'active';
    if (filter === 'inactive')  return m.status === 'inactive';
    if (filter === 'planned')   return m.status === 'planned' || m.status === 'considering';
    return true;
  });

  const order = { active: 0, planned: 1, considering: 2, inactive: 3, archived: 4 };
  const sorted = filtered.slice().sort((a, b) => {
    const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (s !== 0) return s;
    return (a.is_supplement ? 1 : 0) - (b.is_supplement ? 1 : 0);
  });

  return (
    <div className="page meds-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('meds_title')}</h2>
          <div className="page-sub mono">{filtered.length} · {viewLabel(view, t)}</div>
        </div>
        <div className="meds-view-tabs">
          {['list','journal','history'].map(v => (
            <button key={v}
              className={"meds-view-tab mono" + (view === v ? " is-on" : "")}
              onClick={() => setView(v)}>
              {viewLabel(v, t)}
            </button>
          ))}
        </div>
      </header>

      {view === 'list' && (
        <React.Fragment>
          <div className="meds-filter-row">
            {['active','inactive','planned','all'].map(f => (
              <button key={f}
                className={"meds-filter-chip mono" + (filter === f ? " is-on" : "")}
                onClick={() => setFilter(f)}>
                {t('meds_filter_' + f)}
              </button>
            ))}
          </div>

          <div className="medc-grid">
            {sorted.map(med => (
              <window.MedCard
                key={med.id}
                med={med}
                onOpenTake={(m) => setTakeMed(m)}
                onOpenConfig={(m) => setCfgMed(m)}
                onOpenRefill={(m) => setRefMed(m)}
                onOpenDetail={openDetail} />
            ))}
            {sorted.length === 0 && (
              <div className="meds-empty mono">
                · нет препаратов в этой группе ·
              </div>
            )}
          </div>
        </React.Fragment>
      )}

      {view === 'journal' && (
        window.GlobalJournal
          ? <window.GlobalJournal />
          : <div className="ph-card meds-ph">
              <div className="ph-eyebrow mono">ЖУРНАЛ · BATCH 4</div>
              <div className="ph-body">Глобальный фид pharm-notes — Sprint 3A Batch 4.</div>
            </div>
      )}

      {view === 'history' && (
        <div className="meds-history-view">
          <window.ActivityTimeline
            entityType={null}
            entityId={null}
            filter={(e) => e.entity_type === 'med_dose' || e.entity_type === 'med_config' || e.entity_type === 'mode_style'}
            emptyKey="atl_empty"
            limit={200} />
        </div>
      )}

      {takeMed && <window.TakeDoseModal med={takeMed} onClose={() => setTakeMed(null)} />}
      {refillMed && <window.RefillModal med={refillMed} onClose={() => setRefMed(null)} />}
      {configMed && window.MedConfigDrawer && (
        <window.MedConfigDrawer med={configMed} onClose={() => setCfgMed(null)} />
      )}
      {configMed && !window.MedConfigDrawer && (
        <div className="qa-backdrop" onMouseDown={() => setCfgMed(null)}>
          <div className="qa-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="qa-head">
              <span className="qa-eyebrow mono">config · {configMed.id}</span>
              <button className="qa-close" onClick={() => setCfgMed(null)}>×</button>
            </div>
            <div className="ph-body" style={{ padding: 12 }}>Sprint 3A Batch 3 наполнит этот drawer.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseSubRoute() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  if (!raw.startsWith('medications/')) return null;
  const id = raw.slice('medications/'.length);
  return id || null;
}

function viewLabel(view, t) {
  if (view === 'list')    return t('meds_view_list');
  if (view === 'journal') return t('meds_view_journal');
  if (view === 'history') return t('meds_view_history');
  return view;
}

window.MedicationsPage = MedicationsPage;
