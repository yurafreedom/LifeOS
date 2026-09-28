import React from 'react';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useProjectLocale, useRef: useProjectRef, useState: useProjectState } = React;

function formatDateOnly(value, locale) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(LifeStrings[locale]._intl_locale, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function formatInstant(value, locale) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(LifeStrings[locale]._intl_locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  });
}

function ProjectCard({ project, onForecast, onComplete, onArchive }) {
  const { locale, t } = useProjectLocale(LifeLocaleContext);
  const [forecastDate, setForecastDate] = useProjectState(project.current_forecast_date || '');
  const [busyAction, setBusyAction] = useProjectState(null);
  const [error, setError] = useProjectState(null);
  const busyRef = useProjectRef(false);
  const active = project.status === 'active';
  const archiveAllowed = active || project.status === 'completed';

  async function runOnce(action, callback) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction(action);
    setError(null);
    try {
      await callback();
    } catch {
      setError(t('project_action_failed'));
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  function submitForecast(event) {
    event.preventDefault();
    if (!forecastDate) return;
    void runOnce('forecast', () => onForecast(project.id, forecastDate));
  }

  function complete() {
    if (!window.confirm(t('project_complete_confirm', project.title))) return;
    void runOnce('complete', () => onComplete(project.id));
  }

  function archive() {
    if (!window.confirm(t('project_archive_confirm', project.title))) return;
    void runOnce('archive', () => onArchive(project.id));
  }

  return (
    <article className="card panel" data-project-status={project.status} aria-busy={busyRef.current}>
      <div className="panel-head">
        <h3 className="panel-title">{project.title}</h3>
        <span className="task-tag mono">{t(`project_status_${project.status}`)}</span>
      </div>

      <div className="task-meta">
        <span className="panel-meta mono">
          {t('project_started', formatInstant(project.started_at, locale))}
        </span>
      </div>
      <p className="page-sub mono">
        {project.current_forecast_date
          ? t('project_forecast_current', formatDateOnly(project.current_forecast_date, locale))
          : t('project_forecast_not_set')}
      </p>
      {project.completed_at ? (
        <p className="page-sub mono">
          {t('project_completed_at', formatInstant(project.completed_at, locale))}
        </p>
      ) : null}

      {active ? (
        <form className="money-input-row" onSubmit={submitForecast}>
          <label className="money-input-wrap">
            <input
              type="date"
              className="money-input mono"
              aria-label={t('project_forecast_label')}
              value={forecastDate}
              onChange={event => setForecastDate(event.target.value)}
              disabled={busyAction != null}
              required
            />
          </label>
          <button className="set-btn-primary" type="submit" disabled={busyAction != null}>
            {busyAction === 'forecast'
              ? t('project_saving')
              : project.current_forecast_date
                ? t('project_forecast_revise')
                : t('project_forecast_set')}
          </button>
        </form>
      ) : null}

      {error ? <p className="auth-error mono" role="alert">{error || t('project_action_failed')}</p> : null}

      <div className="import-actions">
        {active ? (
          <button className="set-btn-primary" type="button" onClick={complete} disabled={busyAction != null}>
            {busyAction === 'complete' ? t('project_saving') : t('project_complete')}
          </button>
        ) : null}
        {archiveAllowed ? (
          <button className="set-btn-ghost" type="button" onClick={archive} disabled={busyAction != null}>
            {busyAction === 'archive' ? t('project_saving') : t('project_archive')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export { ProjectCard };
