const routes = [
  'home',
  'calendar',
  'notes',
  'me',
  'tasks',
  'habits',
  'goals',
  'projects',
  'health',
  'dog',
  'finances',
  'monthly',
  'annual',
  'investments',
  'medications',
  'settings',
  'updates',
];

export const ANALYTICS_ROUTE_ENABLED = import.meta.env.MODE === 'test'
  || import.meta.env.VITE_LIFEOS_ANALYTICS_ENABLED === 'true';

if (ANALYTICS_ROUTE_ENABLED) routes.push('analytics', 'analytics-history', 'review', 'project-analytics', 'experiment', 'system-review');

export const LIFE_ROUTES = new Set(routes);
