import React from 'react';
import { PageHeader } from '../components/HeroVignette.jsx';
import { ProjectCard } from '../components/ProjectCard.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { ANALYTICS_ROUTE_ENABLED } from '../app/routes.js';

/* global React */
const { useContext: useProjectsContext, useState: useProjectsState } = React;

function ProjectsPage() {
  const data = useProjectsContext(LifeDataContext);
  const { t } = useProjectsContext(LifeLocaleContext);
  const [title, setTitle] = useProjectsState('');
  const [error, setError] = useProjectsState(null);
  const projects = data.state.projects || [];
  const groups = [
    ['active', t('project_group_active')],
    ['completed', t('project_group_completed')],
    ['archived', t('project_group_archived')],
  ];

  function createProject(event) {
    event.preventDefault();
    setError(null);
    try {
      data.addProject(title);
      setTitle('');
    } catch {
      setError(t('project_create_failed'));
    }
  }

  return (
    <div className="page projects-page">
      <PageHeader
        title={t('projects_title')}
        subtitle={t('projects_subtitle', projects.length)}
      />

      <section className="card panel">
        <div className="panel-head">
          <h3 className="panel-title">{t('project_create_title')}</h3>
          <span className="panel-meta mono">{t('project_distinct_from_goal')}</span>
        </div>
        <form className="money-input-row" onSubmit={createProject}>
          <label className="money-input-wrap">
            <input
              className="money-input"
              aria-label={t('project_title_label')}
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={t('project_title_placeholder')}
              maxLength={200}
              required
            />
          </label>
          <button className="set-btn-primary" type="submit">{t('project_create')}</button>
        </form>
        {error ? <p className="auth-error mono" role="alert">{error}</p> : null}
      </section>

      {projects.length === 0 ? (
        <div className="empty-state">{t('projects_empty')}</div>
      ) : groups.map(([status, label]) => {
        const items = projects.filter(project => project.status === status);
        return items.length > 0 ? (
          <section key={status} aria-labelledby={`projects-${status}`}>
            <div className="panel-head">
              <h3 className="panel-title" id={`projects-${status}`}>{label}</h3>
              <span className="panel-meta mono">{items.length}</span>
            </div>
            <div className="panel-grid">
              {items.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onForecast={data.setProjectForecast}
                  onComplete={data.completeProject}
                  onArchive={data.archiveProject}
                  reviewEnabled={ANALYTICS_ROUTE_ENABLED}
                  analyticsEnabled={ANALYTICS_ROUTE_ENABLED}
                />
              ))}
            </div>
          </section>
        ) : null;
      })}
    </div>
  );
}

export { ProjectsPage };
