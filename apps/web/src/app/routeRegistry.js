import { ANALYTICS_ROUTE_ENABLED, LIFE_ROUTES } from './routes.js';

/* ── Routes ────────────────────────────────────────────────
   v2 nav tree. Each route has an id used both as state key and as the
   URL hash (#/<id>). Add a new tab → drop an entry in routes.js + render
   it in App.jsx renderRoute() + add a sidebar item. */
function readRouteFromHash(hash = window.location.hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  /* Sprint 3A · medications sub-routes: /medications/{id} → still
     dispatch the medications surface; the page reads the id itself. */
  if (raw.startsWith('medications/') || raw === 'medications') return 'medications';
  /* JENKIN S2 · finances/documents → the Finances surface, Documents tab. */
  if (raw === 'finances/documents') return 'finances';
  /* Settings → About deep link (the Updates page links back to it). */
  if (raw === 'settings/about') return 'settings';
  /* Slice 4 · review/{new/<subject>/<from>/<to> | <id>} → the Review surface
     reads its own parameters from the hash. */
  if (raw.startsWith('review/') && LIFE_ROUTES.has('review')) return 'review';
  /* Slice 5 · project-analytics/<project id> → the page reads the id itself. */
  if (raw.startsWith('project-analytics/') && LIFE_ROUTES.has('project-analytics')) return 'project-analytics';
  /* Calendar · calendar/{YYYY | YYYY-MM | YYYY-MM-DD | years[/YYYY] | history}
     → the Calendar page reads its own level/date (pages/calendar/calendarRoute.js). */
  if (raw.startsWith('calendar/')) return 'calendar';
  /* Slice 6 · experiment/{new | <uuid>} → the Experiment surface reads its own view. */
  if ((raw === 'experiment' || raw.startsWith('experiment/')) && LIFE_ROUTES.has('experiment')) return 'experiment';
  /* Slice 7 · system-review/{<period>[/tradeoff | /revisions/<n>] | waiting}
     → the System Review page reads its own view (analytics/systemReviewFacts.ts). */
  if (raw.startsWith('system-review/') && LIFE_ROUTES.has('system-review')) return 'system-review';
  return LIFE_ROUTES.has(raw) ? raw : 'home';
}

/* setRoute's target rule: an unknown id falls back to home, except the
   medications/{id} sub-route, which dispatches the medications surface while
   the hash keeps the full path. */
function normalizeRoute(next) {
  if (next === 'finances/documents') return { route: 'finances', hash: '#/finances/documents' };
  if (next === 'settings/about') return { route: 'settings', hash: '#/settings/about' };
  if (!LIFE_ROUTES.has(next) && !next.startsWith('medications/')) next = 'home';
  return { route: LIFE_ROUTES.has(next) ? next : 'medications', hash: '#/' + next };
}

export { ANALYTICS_ROUTE_ENABLED, LIFE_ROUTES, normalizeRoute, readRouteFromHash };
