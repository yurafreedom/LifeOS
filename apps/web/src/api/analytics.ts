/* Adaptive Analytics HTTP API — stable facade. Each domain lives in
   ./analytics/<domain>.ts; callers keep importing from this module. */

export * from './analytics/facts';
export * from './analytics/finance';
export * from './analytics/history';
export * from './analytics/projects';
export * from './analytics/semantic';
export * from './analytics/signals';
export * from './analytics/reviews';
export * from './analytics/experiments';
export * from './analytics/systemReview';
