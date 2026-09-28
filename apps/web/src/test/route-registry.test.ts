import { describe, expect, it } from 'vitest';

import { LIFE_ROUTES, normalizeRoute, readRouteFromHash } from '../app/routeRegistry.js';
import { LIFE_ROUTES as ROUTES_SOURCE } from '../app/routes.js';

/* Characterization of hash → route parsing and setRoute's target rule,
   extracted verbatim from App.jsx. Route hashes are a public contract. */

describe('readRouteFromHash', () => {
  it.each([
    ['', 'home'],
    ['#', 'home'],
    ['#/', 'home'],
    ['#/home', 'home'],
    ['#home', 'home'],
    ['#/tasks', 'tasks'],
    ['#/settings', 'settings'],
    ['#/analytics', 'analytics'],
    ['#/analytics-history', 'analytics-history'],
    ['#/unknown', 'home'],
    ['#/medications', 'medications'],
    ['#/medications/42', 'medications'],
    ['#/review', 'review'],
    ['#/review/new/finance_period/2026-09-01/2026-09-30', 'review'],
    ['#/review/7c1d0f7e-2b1a-4c1e-9a55-0d7f5b1c2e11', 'review'],
    ['#/tasks/extra', 'home'],
  ])('%s → %s', (hash, route) => {
    expect(readRouteFromHash(hash)).toBe(route);
  });

  it('re-exports the same registry as app/routes.js', () => {
    expect(LIFE_ROUTES).toBe(ROUTES_SOURCE);
    expect(LIFE_ROUTES.size).toBe(19);
  });
});

describe('normalizeRoute', () => {
  it.each([
    ['tasks', 'tasks', '#/tasks'],
    ['review', 'review', '#/review'],
    ['medications', 'medications', '#/medications'],
    ['medications/42', 'medications', '#/medications/42'],
    ['nope', 'home', '#/home'],
    ['review/abc', 'home', '#/home'],
  ])('%s → route %s, hash %s', (next, route, hash) => {
    expect(normalizeRoute(next)).toEqual({ route, hash });
  });
});
