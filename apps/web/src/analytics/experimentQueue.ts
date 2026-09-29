/**
 * Experiments — read-only helpers over the local durable queue. Kept apart from
 * the request builders so the eagerly loaded AnalyticsContext does not pull the
 * whole Experiment write surface into the entry chunk.
 */

const EXPERIMENTS_API = '/api/v1/aa/experiments';

type QueueRecordLike = {
  operation_type: string;
  route: string;
  payload: Record<string, unknown>;
};

/** Every unacknowledged record for this experiment, in any state (failed ones included). */
export function pendingExperimentRecords<T extends QueueRecordLike>(records: T[], id: string): T[] {
  const prefix = `${EXPERIMENTS_API}/${id}/`;
  return records.filter(record => record.route.startsWith(prefix)
    || (record.operation_type === 'experiment.create' && record.payload?.id === id));
}

/** Creates the server has not acknowledged yet (the list shows them as «не сохранено»). */
export function pendingCreates<T extends QueueRecordLike>(records: T[]): T[] {
  return records.filter(record => record.operation_type === 'experiment.create');
}
