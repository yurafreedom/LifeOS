/* Adaptive Analytics · finance month and legacy transaction import.
   Imported through ../analytics.ts. */

import { requestJson } from '../client';
import type { DerivedDelta } from '../../analytics/delta';
import type { AACoverageReport, AASemanticFact, AAValue } from './facts';

export type AAFinanceMonth = {
  period: string;
  subject_key: string;
  timezone: string;
  as_of: string;
  availability: 'present' | 'no_data' | 'insufficient_data' | 'retention_truncated';
  actual: AAValue | null;
  known_subtotal: AAValue | null;
  /** Slice 8: the month starts before an applied retention horizon. */
  retention_horizon?: string | null;
  retention_truncated?: boolean;
  transaction_count: number;
  excluded_count: number;
  unknown_membership_count: number;
  policy_known: boolean;
  persisted: false;
  derivation: string;
  series: Array<{ date: string; amount: string }>;
  expectations: AASemanticFact[];
  targets: AASemanticFact[];
  current_expectation: AASemanticFact | null;
  current_target: AASemanticFact | null;
  delta: DerivedDelta;
  desire: 'neutral' | 'favorable' | 'unfavorable' | 'unknown';
  coverage: AACoverageReport;
};

export function getFinanceMonth(
  period: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<AAFinanceMonth> {
  const params = new URLSearchParams({ timezone });
  return requestJson<AAFinanceMonth>(
    `/api/v1/aa/finance/months/${encodeURIComponent(period)}?${params}`,
    { signal },
  );
}

export type LegacyImportResult = {
  transactions_imported: number;
  transactions_replayed: number;
  policies_imported: number;
  policies_replayed: number;
  overrides_imported: number;
  overrides_replayed: number;
  coverage_imported: number;
  coverage_replayed: number;
  /** Slice 8 (F6): erased by retention, never reconstructed. */
  transactions_retention_skipped?: number;
  coverage_retention_skipped?: number;
  activity_log_imported: 0;
  expectations_backfilled: 0;
  forecasts_backfilled: 0;
  targets_backfilled: 0;
  baselines_backfilled: 0;
  synthetic_coverage_backfilled: 0;
  moneywidget_budget_backfilled: 0;
};

export function importLegacyTransactions(timezone: string): Promise<LegacyImportResult> {
  return requestJson<LegacyImportResult>('/api/v1/aa/import/legacy-transactions', {
    method: 'POST',
    body: JSON.stringify({ timezone, coverage: [] }),
  });
}
