import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LAZY_ROUTE_LOADERS, RouteFallback } from '../app/lazyRoutes.jsx';
import { LIFE_ROUTES } from '../app/routeRegistry.js';
import { SettingsPage } from '../components/SettingsPage.jsx';
import { DogPage } from '../pages/DogPage.jsx';
import { MedicationsPage } from '../pages/MedicationsPage.jsx';
import ExperimentPage from '../pages/analytics/ExperimentPage.jsx';
import CalendarPage from '../pages/calendar/CalendarPage.jsx';
import MetricHistoryPage from '../pages/analytics/MetricHistoryPage.jsx';
import ReviewPage from '../pages/analytics/ReviewPage.jsx';
import FinanceAnalytics from '../pages/finances/FinanceAnalytics.jsx';
import ProjectAnalyticsPage from '../pages/projects/ProjectAnalyticsPage.jsx';
import SystemReviewPage from '../pages/analytics/SystemReviewPage.jsx';
import UpdatesPage from '../pages/updates/UpdatesPage.jsx';

/* A lazily-loaded route must resolve to exactly the page component the
   eager import used to render, under the same route id. */
const EAGER = {
  medications: MedicationsPage,
  dog: DogPage,
  settings: SettingsPage,
  analytics: FinanceAnalytics,
  'analytics-history': MetricHistoryPage,
  review: ReviewPage,
  'project-analytics': ProjectAnalyticsPage,
  experiment: ExperimentPage,
  calendar: CalendarPage,
  'system-review': SystemReviewPage,
  updates: UpdatesPage,
};

describe('route-level lazy loading', () => {
  it('lazy-loads exactly the planned route surfaces, all of them real routes', () => {
    expect(Object.keys(LAZY_ROUTE_LOADERS).sort()).toEqual(Object.keys(EAGER).sort());
    for (const route of Object.keys(LAZY_ROUTE_LOADERS)) expect(LIFE_ROUTES.has(route)).toBe(true);
    for (const eager of ['home', 'tasks', 'projects', 'finances']) {
      expect(LAZY_ROUTE_LOADERS[eager]).toBeUndefined();
    }
  });

  it.each(Object.keys(EAGER))('%s resolves to the same page component', async (route) => {
    const module = await LAZY_ROUTE_LOADERS[route]();
    expect(module.default).toBe(EAGER[route]);
  });

  it('falls back to empty page chrome, not a second loading design', () => {
    expect(renderToStaticMarkup(<RouteFallback />)).toBe('<div class="page" aria-busy="true"></div>');
  });
});
