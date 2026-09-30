import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../api/client';
import { SettingsPage } from '../components/SettingsPage.jsx';
import { DangerSection } from '../components/settings/DangerSection.jsx';
import {
  RETENTION_CHOICES,
  RetentionView,
  RunSummary,
  policyBody,
  runApply,
  stateChoice,
} from '../components/settings/RetentionSection.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { sourceDeletedKey } from '../pages/analytics/review/format.js';
import { srDeletedKey } from '../pages/analytics/system/format.js';
import { ForecastComparison } from '../pages/projects/analytics/ForecastComparison.jsx';
import AAQualityStrip from '../components/analytics/AAQualityStrip.jsx';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { email: 'qa@example.com' } }) }));

const DEFAULT_STATE = {
  mode: 'unlimited', retain_months: null, source: 'default', policy_id: null, policy_version: 0,
  recorded_at: null, confirmed_at: null, consequences_version: 'retention-consequences-v1',
  allowed_months: [60, 36, 24], engine_version: 1, target_horizon_date: null,
  effective_horizon: null, latest_run: null, runs: [], prunable: [], preserved: [],
};
const RUN = {
  id: 'run-1', status: 'completed', policy_id: 'p', retain_months: 36,
  target_horizon_date: '2023-09-01', timezone: 'Europe/Kyiv', engine_version: 1,
  started_at: '2026-09-30T10:00:00Z', completed_at: '2026-09-30T10:00:03Z', failed_at: null,
  failure_code: null, total_deleted: 742, table_counts: { aa_measurements: 700, aa_targets: 42 },
  unit_counts: {}, chain_count: 11, project_unit_count: 1, review_redaction_count: 4,
  system_review_redaction_count: 0, relation_redaction_count: 0, importance_redaction_count: 0,
  provenance_redaction_count: 0, signal_episode_count: 0, skipped: {},
};
const PREVIEW = {
  policy_id: 'p', retain_months: 36, timezone: 'Europe/Kyiv', target_horizon_date: '2023-09-01',
  effective_horizon: null, engine_version: 1, computed_at: '2026-09-30T10:00:00Z',
  total_deleted: 742, table_counts: {}, unit_counts: {}, chain_count: 11, project_unit_count: 1,
  review_redaction_count: 4, system_review_redaction_count: 2, relation_redaction_count: 0,
  importance_redaction_count: 0, provenance_redaction_count: 0, signal_episode_count: 0,
  skipped: {}, preserved: [], preview_token: 'a'.repeat(64),
};

function view(props, locale = 'ru') {
  const t = LifeMakeT(locale);
  return { t, html: renderToStaticMarkup(<RetentionView t={t} {...props} />) };
}

describe('Settings · AA history retention (Slice 8)', () => {
  for (const locale of ['ru', 'uk']) {
    it(`defaults to Unlimited and offers only 5 / 3 / 2 years (${locale})`, () => {
      const { t, html } = view({ state: DEFAULT_STATE }, locale);
      expect(RETENTION_CHOICES).toEqual(['unlimited', 60, 36, 24]);
      expect((html.match(/type="radio"/g) || []).length).toBe(4);
      for (const key of ['ret_unlimited', 'ret_months_60', 'ret_months_36', 'ret_months_24', 'ret_default',
        'ret_current_default', 'ret_horizon_none']) {
        expect(html).toContain(t(key));
      }
      expect(html).toContain('checked="" value="unlimited"');
      for (const shorter of ['1 год', '12', '90', '30 дн']) expect(html).not.toContain(`>${shorter}<`);
      expect(html).not.toContain(t('ret_preview'));  // nothing to preview while Unlimited
      expect(html).toContain('<fieldset');
      expect(html).toContain('<legend');
    });
  }

  it('shows the consequences and requires confirmation before a finite policy is saved', () => {
    const { t, html } = view({ state: DEFAULT_STATE, ui: { choice: 36 } });
    for (const key of ['ret_consequences_title', 'ret_c_measurements', 'ret_c_coverage', 'ret_c_projects',
      'ret_keep_title', 'ret_d_finance', 'ret_d_projects', 'ret_d_reviews', 'ret_d_irreversible',
      'ret_confirm_label']) {
      expect(html).toContain(t(key));
    }
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*сохранить правило/i);
    const confirmed = view({ state: DEFAULT_STATE, ui: { choice: 36, understood: true } }).html;
    expect(confirmed).not.toMatch(/<button[^>]*disabled=""[^>]*>Сохранить правило/);
  });

  it('builds a finite PUT only with the confirmation and never a shorter duration', () => {
    expect(policyBody(24, DEFAULT_STATE, true, 'k-1')).toEqual({
      mode: 'finite', retain_months: 24, consequences_version: 'retention-consequences-v1',
      confirm_consequences: true, idempotency_key: 'k-1',
    });
    expect(policyBody('unlimited', DEFAULT_STATE, false, 'k-2')).toEqual({
      mode: 'unlimited', idempotency_key: 'k-2',
    });
    expect(stateChoice({ mode: 'finite', retain_months: 60 })).toBe(60);
    expect(stateChoice(null)).toBe('unlimited');
  });

  it('previews counts, then asks for a destructive confirmation', () => {
    const finite = { ...DEFAULT_STATE, mode: 'finite', retain_months: 36, source: 'explicit' };
    const { t, html } = view({ state: finite, ui: { preview: PREVIEW } });
    expect(html).toContain(t('ret_preview'));
    expect(html).toContain(t('ret_preview_total', 742));
    expect(html).toContain(t('ret_preview_chains', 11));
    expect(html).toContain(t('ret_preview_reviews', 4));
    expect(html).toContain(t('ret_apply'));
    const confirming = view({ state: finite, ui: { preview: PREVIEW, confirming: true } }).html;
    expect(confirming).toContain('role="alertdialog"');
    expect(confirming).toContain(t('ret_confirm_text', 742));
    expect(confirming).toContain(t('ret_confirm_do'));
    expect(confirming).toContain('tabindex="-1"');
    const zero = view({ state: finite, ui: { preview: { ...PREVIEW, total_deleted: 0,
      review_redaction_count: 0, system_review_redaction_count: 0 } } }).html;
    expect(zero).toContain(t('ret_preview_zero'));
    expect(zero).not.toContain(t('ret_apply'));
  });

  it('shows current intent, the stricter applied horizon and the last run separately', () => {
    const state = { ...DEFAULT_STATE, source: 'explicit', latest_run: RUN, runs: [RUN],
      effective_horizon: { date: '2023-09-01', timezone: 'Europe/Kyiv', run_id: 'run-1' } };
    const { t, html } = view({ state });
    expect(html).toContain(t('ret_current', t('ret_unlimited')));
    expect(html).toContain(t('ret_horizon_differs'));
    expect(html).toContain(t('ret_last_run'));
    expect(html).toContain(t('ret_run_deleted', 742));
    expect(html).toContain(t('ret_run_chains', 11));
    expect(html).toContain(t('ret_run_reviews', 4));
    expect(html).toContain(t('ret_t_aa_measurements'));
    const failed = renderToStaticMarkup(<RunSummary t={t} run={{ ...RUN, status: 'failed',
      completed_at: null, failed_at: '2026-09-30T10:00:00Z', failure_code: 'OperationalError',
      total_deleted: 0 }} />);
    expect(failed).toContain('OperationalError');
  });

  it('never calls or queues Apply offline, and maps stale / network / failure truthfully', async () => {
    const client = { applyRetention: vi.fn() };
    expect(await runApply(client, { preview: PREVIEW, key: 'k', online: false }))
      .toEqual({ outcome: 'offline' });
    expect(client.applyRetention).not.toHaveBeenCalled();
    client.applyRetention.mockRejectedValueOnce(new ApiError(409, 'retention_preview_stale', 'stale'));
    expect((await runApply(client, { preview: PREVIEW, key: 'k', online: true })).outcome).toBe('stale');
    client.applyRetention.mockRejectedValueOnce(new NetworkError(new Error('down')));
    expect((await runApply(client, { preview: PREVIEW, key: 'k', online: true })).outcome).toBe('offline');
    client.applyRetention.mockRejectedValueOnce(new ApiError(500, 'boom', 'boom'));
    expect((await runApply(client, { preview: PREVIEW, key: 'k', online: true })).outcome).toBe('failed');
    client.applyRetention.mockResolvedValueOnce(RUN);
    const done = await runApply(client, { preview: PREVIEW, key: 'k-9', online: true });
    expect(done.outcome).toBe('completed');
    expect(client.applyRetention).toHaveBeenLastCalledWith({
      preview_token: PREVIEW.preview_token, timezone: 'Europe/Kyiv', idempotency_key: 'k-9',
    });
  });

  it('is its own Settings section, separate from the activityLog cleanup', () => {
    const t = LifeMakeT('ru');
    const settings = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ t, locale: 'ru', setLocale() {} }}>
        <LifeDataContext.Provider value={{ state: { categoryOverrides: {} } }}>
          <SettingsPage />
        </LifeDataContext.Provider>
      </LifeLocaleContext.Provider>,
    );
    expect(settings).toContain(t('set_retention'));
    const danger = renderToStaticMarkup(
      <LifeDataContext.Provider value={{ syncPhase: 'idle', state: { activityLog: [] } }}>
        <DangerSection t={t} />
      </LifeDataContext.Provider>,
    );
    expect(danger).toContain(t('set_clear_history_hint'));
    expect(danger).not.toContain(t('ret_title'));
    expect(LifeStrings.ru.set_retention).toBe('хранение аналитической истории');
    expect(LifeStrings.uk.set_retention).toBe('зберігання аналітичної історії');
  });

  it('keeps RU/UK parity for every retention key', () => {
    const keys = Object.keys(LifeStrings.ru).filter(key => key.startsWith('ret_')
      || key.startsWith('aa_ret_') || key.endsWith('_retention') || key === 'set_retention'
      || key.includes('history_deleted'));
    expect(keys.length).toBeGreaterThan(80);
    for (const key of keys) {
      expect(LifeStrings.uk[key], key).toBeTruthy();
      expect(LifeStrings.uk[key]).not.toBe(LifeStrings.ru[key]);
    }
  });
});

describe('Retention-truncated read surfaces (Slice 8)', () => {
  const t = LifeMakeT('ru');

  it('tells a retention erasure apart from a manual hard delete', () => {
    expect(sourceDeletedKey({ redacted: true, redaction_reason: 'source_retention_pruned' }))
      .toBe('aa_pr_source_deleted_retention');
    expect(sourceDeletedKey({ redacted: true, redaction_reason: 'source_hard_deleted' }))
      .toBe('aa_pr_source_deleted');
    expect(srDeletedKey({ redacted: true, redaction_reason: 'source_retention_pruned' }))
      .toBe('aa_sr_source_deleted_retention');
    expect(t('aa_pr_source_deleted_retention')).not.toBe(t('aa_pr_source_deleted'));
  });

  it('Project Analytics says history was deleted, not «not recorded yet»', () => {
    const html = renderToStaticMarkup(<ForecastComparison t={t} locale="ru" data={{
      state: 'history_deleted_by_retention', first_forecast: null, latest_forecast: null, actual: null,
    }} />);
    expect(html).toContain(t('aa_pj_state_history_deleted'));
    expect(html).not.toContain(t('aa_pj_state_no_facts'));
  });

  it('the quality strip lists erased days as their own bucket', () => {
    const html = renderToStaticMarkup(
      <LifeLocaleContext.Provider value={{ t }}>
        <AAQualityStrip coverage={{ observed_count: 0, expected_denominator: 31, partial_count: 0,
          missing_count: 0, unknown_coverage_count: 0, future_count: 0, estimated_count: 0,
          corrected_count: 0, has_legacy_imports: false, retention_truncated_count: 31 }} />
      </LifeLocaleContext.Provider>,
    );
    expect(html).toContain(t('aa_ret_q_truncated'));
  });
});

describe('Retention never rides the durable analytics queue (R8-69/70)', () => {
  it('has no queue import and no queue operation for policy or Apply', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(process.cwd(), 'src');
    const client = readFileSync(join(root, 'api/analytics/retention.ts'), 'utf8');
    const section = readFileSync(join(root, 'components/settings/RetentionSection.jsx'), 'utf8');
    for (const source of [client, section]) {
      expect(source).not.toMatch(/import[^;]*(analyticsWriteQueue|analyticsRepository|repositories\/)/);
      expect(source).not.toMatch(/\benqueue\w*\(/);
    }
    for (const name of readdirSync(join(root, 'repositories'))) {
      expect(readFileSync(join(root, 'repositories', name), 'utf8')).not.toMatch(/retention/i);
    }
  });
});
