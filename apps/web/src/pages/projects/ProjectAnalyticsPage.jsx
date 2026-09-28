import React from 'react';
import { ANALYTICS_ROUTE_ENABLED } from '../../app/routes.js';
import { parseProjectAnalyticsHash } from '../../analytics/projectAnalytics';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { projectReviewHash } from '../../components/ProjectCard.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { AnalyticsContext } from '../../context/AnalyticsContext.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { ForecastComparison } from './analytics/ForecastComparison.jsx';
import { ForecastHistory } from './analytics/ForecastHistory.jsx';
import '../../analytics.css';

/*
 * G · Project Analytics — a read-only view over facts Slice P already writes.
 *
 * The server answers the forecast version history, the separate Actual and the
 * dual delta; the snapshot only supplies the project's title and current status.
 * `current_forecast_date` is never counted: a forecast the server has not yet
 * acknowledged is reported as an unsynchronised record, not as history.
 * No task count, no «typical for me», no cause, no score.
 */

function useNarrow() {
  const query = '(max-width: 700px)';
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

function QualityStrip({ data, t }) {
  return <div className="aa-quality aa-pj-strip" role="group" aria-label={t('aa_pj_quality_group')}>
    <span className="aa-quality-item">{t('aa_pj_versions')}: <b>{data.forecast_version_count}</b> · {t('aa_pj_actual_separate')}</span>
    {data.observation_count > 0
      ? <span className="aa-quality-item">{t('aa_pj_observations')}: <b>{data.observation_count}</b></span>
      : null}
    {data.withdrawn_forecast_count > 0
      ? <span className="aa-quality-item">{t('aa_pj_withdrawn', data.withdrawn_forecast_count)}</span>
      : null}
  </div>;
}

/**
 * The page body for one project. Pure: it renders whatever state it is given,
 * so every truthful state can be shown (and tested) without a network.
 */
export function ProjectAnalyticsView({
  project, data = null, error = null, pending = 0, narrow = false, reviewEnabled = ANALYTICS_ROUTE_ENABLED,
}) {
  const t = useAAText();
  const locale = t('_intl_locale');
  const back = <nav className="aa-pj-nav" aria-label={t('aa_pj_nav_group')}>
    <a className="aa-link" href="#/projects">{t('aa_pj_back')}</a>
  </nav>;

  if (!project) {
    return <div className="page project-analytics-page">
      <PageHeader title={t('aa_pj_title')} />
      <section className="card panel aa-section">
        <p className="aa-none">{t('aa_pj_not_found')}</p>
        {back}
      </section>
    </div>;
  }

  const subtitle = [t('aa_pj_eyebrow'), t(`project_status_${project.status}`)].join(' · ');
  const reviewable = reviewEnabled && project.status === 'completed';

  return <div className={`page project-analytics-page${narrow ? ' aa-narrow' : ''}`}>
    <PageHeader title={project.title} subtitle={subtitle} aside={back} />

    {pending > 0 ? <p className="aa-note aa-pj-pending" role="status">{t('aa_pj_pending', pending)}</p> : null}

    {error
      ? <section className="card panel"><p className="aa-none" role="alert">{t('aa_pj_unavailable')}</p></section>
      : !data
        ? <section className="card panel" aria-busy="true"><p className="aa-note">{t('aa_pj_loading')}</p></section>
        : <>
          <section className="card panel aa-section" aria-labelledby="pa-compare">
            <div className="aa-section-head">
              <h3 className="panel-title" id="pa-compare">{t('aa_pj_compare_title')}</h3>
              <span className="aa-quiet">{t('aa_pj_compare_sub')}</span>
            </div>
            <ForecastComparison data={data} t={t} locale={locale} />
            <QualityStrip data={data} t={t} />
          </section>
          <section className="card panel aa-section" aria-labelledby="pa-history">
            <ForecastHistory data={data} t={t} locale={locale} narrow={narrow} />
          </section>
        </>}

    {reviewable
      ? <div className="aa-actions aa-pj-review">
        <span className="aa-quiet">{t('aa_pj_review_hint')}</span>
        <a className="set-btn-primary" href={projectReviewHash(project)}>{t('aa_rv_open_review')}</a>
      </div>
      : null}
  </div>;
}

export default function ProjectAnalyticsPage() {
  const analytics = React.useContext(AnalyticsContext);
  const projects = React.useContext(LifeDataContext)?.state?.projects ?? [];
  const narrow = useNarrow();
  const [projectId, setProjectId] = React.useState(() => parseProjectAnalyticsHash(readHash()));
  const [result, setResult] = React.useState({ error: null, data: null });
  const [pending, setPending] = React.useState(0);
  const project = projects.find(item => item.id === projectId) ?? null;
  const ready = Boolean(analytics?.ready);
  const sync = analytics?.sync;
  const unavailable = analytics != null && analytics.enabled === false;

  React.useEffect(() => {
    const onHash = () => setProjectId(parseProjectAnalyticsHash(readHash()));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* Re-count the project's unacknowledged local writes whenever the queue reports. */
  React.useEffect(() => {
    if (!ready || !project) return undefined;
    let live = true;
    analytics.pendingProjectWrites(project.id)
      .then(count => { if (live) setPending(count); })
      .catch(() => { if (live) setPending(0); });
    return () => { live = false; };
  }, [ready, project?.id, sync]);

  /* The history is re-read when the pending count changes, i.e. after a drain. */
  React.useEffect(() => {
    if (!ready || !project) return undefined;
    const controller = new window.AbortController();
    setResult(previous => ({ ...previous, error: null }));
    analytics.readProjectAnalytics(project.id, controller.signal)
      .then(data => setResult({ error: null, data }))
      .catch(error => {
        if (error?.name !== 'AbortError') setResult({ error, data: null });
      });
    return () => controller.abort();
  }, [ready, project?.id, pending]);

  return <ProjectAnalyticsView project={project} data={result.data} pending={pending} narrow={narrow}
    error={unavailable ? new Error('Analytics is disabled.') : result.error} />;
}
