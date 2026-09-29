/**
 * System Review (Slice 7) — read-only helpers over the local durable queue.
 * Kept apart from the request builders so the eagerly loaded AnalyticsContext
 * does not pull the System Review write surface into the entry chunk.
 */

const OPERATIONS = [
  'relation.create', 'relation.respond', 'relation.feedback', 'relation.delete',
  'importance.set', 'finance_context.append', 'finance_context.delete', 'system_review.revision',
];

type QueueRecordLike = {
  operation_type: string;
  route: string;
  payload: Record<string, unknown>;
};

/** Every unacknowledged Slice 7 record, in any state (failed ones included). */
export function pendingSystemReviewRecords<T extends QueueRecordLike>(records: T[]): T[] {
  return records.filter(record => OPERATIONS.includes(record.operation_type));
}
