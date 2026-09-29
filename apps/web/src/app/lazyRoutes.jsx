import React from 'react';

/* Route surfaces fetched on first visit instead of shipping in the entry
   chunk. Home, Login and the shell stay eager (default route, auth gate,
   always-used chrome). Each loader resolves to the page's module as
   { default: Page } so React.lazy and tests share one definition. */
const LAZY_ROUTE_LOADERS = {
  medications: () => import('../pages/MedicationsPage.jsx').then(m => ({ default: m.MedicationsPage })),
  dog: () => import('../pages/DogPage.jsx').then(m => ({ default: m.DogPage })),
  settings: () => import('../components/SettingsPage.jsx').then(m => ({ default: m.SettingsPage })),
  analytics: () => import('../pages/finances/FinanceAnalytics.jsx'),
  'analytics-history': () => import('../pages/analytics/MetricHistoryPage.jsx'),
  review: () => import('../pages/analytics/ReviewPage.jsx'),
  'project-analytics': () => import('../pages/projects/ProjectAnalyticsPage.jsx'),
  experiment: () => import('../pages/analytics/ExperimentPage.jsx'),
  'system-review': () => import('../pages/analytics/SystemReviewPage.jsx'),
  calendar: () => import('../pages/calendar/CalendarPage.jsx'),
};

const MedicationsPage = React.lazy(LAZY_ROUTE_LOADERS.medications);
const DogPage = React.lazy(LAZY_ROUTE_LOADERS.dog);
const SettingsPage = React.lazy(LAZY_ROUTE_LOADERS.settings);
const FinanceAnalytics = React.lazy(LAZY_ROUTE_LOADERS.analytics);
const MetricHistoryPage = React.lazy(LAZY_ROUTE_LOADERS['analytics-history']);
const ReviewPage = React.lazy(LAZY_ROUTE_LOADERS.review);
const ProjectAnalyticsPage = React.lazy(LAZY_ROUTE_LOADERS['project-analytics']);
const ExperimentPage = React.lazy(LAZY_ROUTE_LOADERS.experiment);
const CalendarPage = React.lazy(LAZY_ROUTE_LOADERS.calendar);
const SystemReviewPage = React.lazy(LAZY_ROUTE_LOADERS['system-review']);

/* The one Suspense fallback: empty page chrome, no second loading design. */
function RouteFallback() {
  return <div className="page" aria-busy="true" />;
}

export {
  CalendarPage,
  DogPage,
  ExperimentPage,
  FinanceAnalytics,
  LAZY_ROUTE_LOADERS,
  MedicationsPage,
  MetricHistoryPage,
  ProjectAnalyticsPage,
  ReviewPage,
  RouteFallback,
  SettingsPage,
  SystemReviewPage,
};
