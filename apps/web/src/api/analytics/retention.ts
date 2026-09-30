/* Adaptive Analytics · history retention (Slice 8).
   Direct calls only: policy changes and the destructive Apply are never routed
   through the offline AnalyticsWriteQueue — an Apply that was not confirmed
   online must fail visibly, never replay later. Imported through ../analytics.ts. */

import { requestJson } from '../client';

export type RetentionMonths = 24 | 36 | 60;

export type RetentionRun = {
  id: string;
  status: 'running' | 'completed' | 'failed';
  policy_id: string;
  retain_months: RetentionMonths;
  target_horizon_date: string;
  timezone: string;
  engine_version: number;
  started_at: string;
  completed_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  total_deleted: number;
  table_counts: Record<string, number>;
  unit_counts: Record<string, unknown>;
  chain_count: number;
  project_unit_count: number;
  review_redaction_count: number;
  system_review_redaction_count: number;
  relation_redaction_count: number;
  importance_redaction_count: number;
  provenance_redaction_count: number;
  signal_episode_count: number;
  skipped: Record<string, number>;
  replayed?: boolean;
};

export type RetentionHorizon = {
  date: string;
  timezone: string;
  run_id: string;
  applied_at?: string;
};

export type RetentionPolicyState = {
  mode: 'unlimited' | 'finite';
  retain_months: RetentionMonths | null;
  source: 'default' | 'explicit';
  policy_id: string | null;
  policy_version: number;
  recorded_at: string | null;
  confirmed_at: string | null;
  consequences_version: string;
  allowed_months: RetentionMonths[];
  engine_version: number;
  target_horizon_date: string | null;
  effective_horizon: RetentionHorizon | null;
  latest_run: RetentionRun | null;
  runs: RetentionRun[];
  prunable: string[];
  preserved: string[];
  changed?: boolean;
  replayed?: boolean;
};

export type RetentionPreview = {
  policy_id: string;
  retain_months: RetentionMonths;
  timezone: string;
  target_horizon_date: string;
  effective_horizon: RetentionHorizon | null;
  engine_version: number;
  computed_at: string;
  total_deleted: number;
  table_counts: Record<string, number>;
  unit_counts: Record<string, unknown>;
  chain_count: number;
  project_unit_count: number;
  review_redaction_count: number;
  system_review_redaction_count: number;
  relation_redaction_count: number;
  importance_redaction_count: number;
  provenance_redaction_count: number;
  signal_episode_count: number;
  skipped: Record<string, number>;
  preserved: string[];
  preview_token: string;
};

const POLICY = '/api/v1/aa/retention-policy';

export function getRetentionPolicy(timezone: string, signal?: AbortSignal): Promise<RetentionPolicyState> {
  return requestJson<RetentionPolicyState>(`${POLICY}?${new URLSearchParams({ timezone })}`, { signal });
}

export function putRetentionPolicy(body: {
  mode: 'unlimited' | 'finite';
  retain_months?: RetentionMonths;
  consequences_version?: string;
  confirm_consequences?: boolean;
  idempotency_key: string;
}): Promise<RetentionPolicyState> {
  return requestJson<RetentionPolicyState>(POLICY, { method: 'PUT', body: JSON.stringify(body) });
}

export function previewRetention(timezone: string): Promise<RetentionPreview> {
  return requestJson<RetentionPreview>(`${POLICY}/preview`, {
    method: 'POST',
    body: JSON.stringify({ timezone }),
  });
}

export function applyRetention(body: {
  preview_token: string;
  timezone: string;
  idempotency_key: string;
}): Promise<RetentionRun> {
  return requestJson<RetentionRun>(`${POLICY}/apply`, {
    method: 'POST',
    body: JSON.stringify({ ...body, confirm: true }),
  });
}
