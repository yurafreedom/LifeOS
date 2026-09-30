import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { ProjectAnalyticsView, resultForProject } from '../pages/projects/ProjectAnalyticsPage.jsx';

/* Completion-audit D1: below the «history deleted» notice, the history sections
   must not claim «no versions» / «completion not recorded». Deletion is read only
   from the server's retention flag, never inferred from an empty array. */

const date = value => ({ type: 'date', unit_code: null, num: null, date: value, text: null, scale_min: null, scale_max: null });
const provenance = recorded_at => ({
  source_kind: 'USER_REPORTED', basis: 'Прогноз завершения проекта пользователя', method: 'MANUAL_FORECAST',
  recorded_at, source_ref: null, original_recorded_at_known: true,
});
const version = {
  id: 'f1', concept: 'forecast', fact_table: 'aa_forecast_versions', subject_key: 'project:project:p-done',
  metric_key: 'project.completion_date', value: date('2026-08-26'), value_type: 'date', dimensions: null,
  provenance: provenance('2026-08-20T12:00:00Z'), status: 'active', supersedes_id: null,
  superseded_by_id: null, superseded_at: null, supersede_kind: null, supersede_reason: null,
  horizon_at: '2026-08-26T21:00:00Z',
};
const actual = {
  id: 'a1', metric_key: 'project.completion_date', subject_key: 'project:project:p-done', value: date('2026-08-25'),
  occurred_at: '2026-08-25T12:00:00Z', occurred_tz: 'Europe/Kyiv',
  provenance: { ...provenance('2026-08-25T12:00:00Z'), source_kind: 'OBSERVED' },
  status: 'active', supersedes_id: null, superseded_by_id: null, supersede_kind: null,
};
const unknownDelta = {
  reference_forecast_id: null, desire: 'unknown', grounding_id: null, grounding_kind: null,
  delta: { state: 'unknown', type: null, num: null, unit_code: null, reason: 'operand_absent' },
};
const empty = {
  subject_key: 'project:project:p-done', metric_key: 'project.completion_date', as_of: null,
  evaluated_at: '2026-09-30T09:00:00Z', state: 'no_facts',
  retention_history_deleted: false, retention_horizon: null,
  forecast_versions: [], forecast_version_count: 0, forecast_versions_truncated: false, withdrawn_forecast_count: 0,
  first_forecast: null, latest_forecast: null, actual: null, actual_count: 0, actual_corrections: [],
  delta_vs_first: unknownDelta, delta_vs_latest: unknownDelta, observation_count: 0,
};
const deleted = {
  ...empty, state: 'history_deleted_by_retention', retention_history_deleted: true, retention_horizon: '2024-09-01',
};
const project = {
  id: 'p-done', title: 'Завершённый проект', status: 'completed', created_at: '2023-01-01T09:00:00Z',
  started_at: '2023-01-01T09:00:00Z', current_forecast_date: '2023-03-01', completed_at: '2023-03-01T12:00:00Z',
};

const render = (data, locale = 'ru') => renderToStaticMarkup(
  <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), setLocale: () => {} }}>
    <ProjectAnalyticsView project={project} data={data} reviewEnabled={false} />
  </LifeLocaleContext.Provider>,
);
const historySection = html => html.slice(html.indexOf('id="pa-history"'));

describe('Project history after retention deletion (audit D1)', () => {
  for (const locale of ['ru', 'uk']) {
    const t = LifeMakeT(locale);

    it(`${locale}: an erased project says the history is unavailable, not «never recorded»`, () => {
      const history = historySection(render(deleted, locale));
      expect(history).toContain(t('aa_pj_no_versions_retention'));
      expect(history).toContain(t('aa_pj_actual_absent_retention'));
      expect(history).not.toContain(t('aa_pj_no_versions'));
      expect(history).not.toContain(t('aa_pj_actual_absent_long'));
    });

    it(`${locale}: an ordinary empty project keeps «not recorded», even under a retention policy`, () => {
      for (const data of [empty, { ...empty, retention_horizon: '2024-09-01' }]) {
        const history = historySection(render(data, locale));
        expect(history).toContain(t('aa_pj_no_versions'));
        expect(history).toContain(t('aa_pj_actual_absent_long'));
        expect(history).not.toContain(t('aa_pj_no_versions_retention'));
        expect(history).not.toContain(t('aa_pj_actual_absent_retention'));
      }
    });

    it(`${locale}: retained evidence is still rendered and never labelled as deleted`, () => {
      const kept = {
        ...empty, state: 'compared', retention_horizon: '2024-09-01',
        forecast_versions: [version], forecast_version_count: 1, first_forecast: version, latest_forecast: version,
        actual, actual_count: 1,
      };
      const history = historySection(render(kept, locale));
      expect(history).toContain('data-version-status="active"');
      expect(history).toContain('data-actual-status="active"');
      expect(history).not.toContain(t('aa_pj_no_versions_retention'));
      expect(history).not.toContain(t('aa_pj_actual_absent_retention'));
      expect(history).not.toContain(t('aa_pj_no_versions'));
    });

    it(`${locale}: under the retention flag, a record the server still returns is shown, not hidden`, () => {
      const partial = { ...deleted, forecast_versions: [version], forecast_version_count: 1 };
      const history = historySection(render(partial, locale));
      expect(history).toContain('data-version-status="active"');
      expect(history).not.toContain(t('aa_pj_no_versions_retention'));
      expect(history).toContain(t('aa_pj_actual_absent_retention'));
    });
  }

  it('has distinct RU/UK copy that does not assert a deleted fact existed', () => {
    const ru = LifeMakeT('ru');
    const uk = LifeMakeT('uk');
    for (const key of ['aa_pj_no_versions_retention', 'aa_pj_actual_absent_retention']) {
      expect(ru(key)).not.toBe(key);
      expect(uk(key)).not.toBe(key);
      expect(uk(key)).not.toBe(ru(key));
      expect(uk(key)).not.toMatch(/[ыэъё]/i);
    }
    expect(ru('aa_pj_actual_absent_retention')).not.toMatch(/был[аио]? (записан|завершён)/);
  });

  it('never shows one project\'s retention state under another project\'s title', () => {
    const held = { projectId: 'p-done', error: null, data: deleted };
    expect(resultForProject(held, 'p-done').data).toBe(deleted);
    expect(resultForProject(held, 'p-fresh')).toEqual({ error: null, data: null });
    const html = render(resultForProject(held, 'p-fresh').data);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(LifeMakeT('ru')('aa_pj_state_history_deleted'));
  });
});
