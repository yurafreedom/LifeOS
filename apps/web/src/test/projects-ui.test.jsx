import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectCard } from '../components/ProjectCard.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { ProjectsPage } from '../pages/ProjectsPage.jsx';

const PROJECT = {
  id: 'project-lifeos',
  title: 'Запуск LifeOS',
  created_at: '2026-08-01T09:00:00.000Z',
  started_at: '2026-08-01T09:00:00.000Z',
  status: 'active',
  current_forecast_date: null,
  completed_at: null,
};

function localeValue(themeEff = 'dark') {
  return { locale: 'ru', t: LifeMakeT('ru'), themeEff };
}

describe('Projects UI', () => {
  it('renders a truthful empty Projects page with the production paradise Hero', () => {
    const data = {
      state: { projects: [] },
      addProject: vi.fn(),
      setProjectForecast: vi.fn(),
      completeProject: vi.fn(),
      archiveProject: vi.fn(),
    };
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={localeValue('paradise')}>
        <LifeDataContext.Provider value={data}>
          <ProjectsPage />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain('class="hero-scene"');
    expect(html).toContain('проектов пока нет');
    expect(html).toContain('создать проект');
  });

  it('renders only legal Project controls and keeps an explicit in-flight double-submit guard', () => {
    const completed = {
      ...PROJECT,
      status: 'completed',
      current_forecast_date: '2026-08-24',
      completed_at: '2026-08-25T18:00:00.000Z',
    };
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={localeValue()}>
        <ProjectCard
          project={completed}
          onForecast={vi.fn()}
          onComplete={vi.fn()}
          onArchive={vi.fn()}
        />
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain('завершён');
    expect(html).toContain('в архив');
    expect(html).not.toContain('задать прогноз');
    expect(html).not.toContain('изменить прогноз');

    const source = readFileSync(new URL('../components/ProjectCard.jsx', import.meta.url), 'utf8');
    expect(source).toContain('if (busyRef.current) return;');
    expect(source).toContain('disabled={busyAction != null}');
  });
});
