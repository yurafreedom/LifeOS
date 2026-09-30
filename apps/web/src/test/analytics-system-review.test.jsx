import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LAZY_ROUTE_LOADERS } from '../app/lazyRoutes.jsx';
import { LIFE_ROUTES } from '../app/routeRegistry.js';
import AAImportance from '../components/analytics/AAImportance.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { pendingIndex } from '../pages/analytics/SystemReviewPage.jsx';
import { buildLookup, deltaText, refText } from '../pages/analytics/system/format.js';
import { LinkDialog } from '../pages/analytics/system/LinkDialog.jsx';
import { ProposalCard } from '../pages/analytics/system/Relations.jsx';
import { ReviewView } from '../pages/analytics/system/ReviewView.jsx';
import { RevisionView } from '../pages/analytics/system/RevisionView.jsx';
import { WaitingView } from '../pages/analytics/system/Waiting.jsx';

function render(node, locale = 'ru') {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(<LifeLocaleContext.Provider value={{ t, locale }}>{node}</LifeLocaleContext.Provider>);
}

const uah = num => ({ type: 'money', unit_code: 'UAH', num, date: null, text: null, scale_min: null, scale_max: null });
const OBLIGATION = 'b1b2c3d4-0000-4000-8000-000000000001';
const EXPENSE_CTX = 'b1b2c3d4-0000-4000-8000-000000000002';
const TX_REF = 'subject|finance:transaction:t1';
const SPEND_REF = 'change|finance_target_state|finance:period:2026-09|finance.monthly_spend|2026-09';
const PRIOR_REF = 'change|finance_spend_vs_prior|finance:period:2026-09|finance.monthly_spend|2026-09';

function impact(kind, state, extra = {}) {
  return { kind, state, inputs: [], assumptions: [], calculation: null, horizon: null, result: null, missing_inputs: [], limitations: [], ...extra };
}

const candidate = {
  proposal_key: 'c'.repeat(64), family: 'finance_emotional_context', rule_version: 1, source: 'rule', status: 'proposed',
  from: { key: `context|${EXPENSE_CTX}`, domain: 'finance' }, to: { key: TX_REF, domain: 'finance' },
  relation_type: 'may_contribute_to', epistemic_kind: 'hypothesis', period: '2026-09',
  evidence: [{ ref: TX_REF, role: 'expense' }],
  conditions: [{ field: 'plannedness', value: 'unplanned' }, { field: 'emotional_context_recorded', value: true }],
  input_fingerprint: 'f'.repeat(64), rank: 1, history: { approved: 2, rejected: 1, unsure: 0 },
};

function review(overrides = {}) {
  return {
    period: '2026-09', period_kind: 'month', timezone: 'Europe/Kyiv', window_start: '2026-09-01', window_end: '2026-09-30',
    evaluated_at: '2026-10-15T09:00:00Z', period_state: 'ended', status: 'AVAILABLE', not_a_verdict: true,
    saved: { count: 0, latest_revision: null, finalized_revision: null, has_newer_draft: false },
    sections: {
      changed: { items: [
        { ref: SPEND_REF, kind: 'finance_target_state', domain: 'finance', subject_key: 'finance:period:2026-09', period: '2026-09',
          current: { concept: 'actual', value: uah('4180.000000'), availability: 'present' },
          reference: { concept: 'target', value: uah('4000.000000'), availability: 'present' },
          delta: { state: 'known', value: { type: 'money', unit_code: 'UAH', num: '180.000000' }, direction: 'higher' },
          desire: 'unfavorable', basis: { kind: 'target', direction: 'lower', reference: uah('4000.000000') },
          details: { target_state: 'present', direction: 'lower' }, coverage: { partial: 0, unknown_coverage: 30 } },
        { ref: PRIOR_REF, kind: 'finance_spend_vs_prior', domain: 'finance', subject_key: 'finance:period:2026-09', period: '2026-09',
          current: { concept: 'actual', value: uah('4180.000000'), availability: 'present' },
          reference: { concept: 'prior_actual', value: null, availability: 'no_data' },
          delta: { state: 'unknown', reason: 'operand_absent' }, desire: 'neutral', basis: null, details: {} },
      ], truncated: false },
      improved: { items: [], truncated: false },
      repeated: { items: [], truncated: false },
      tradeoffs: { items: [{ kind: 'tradeoff', period: '2026-09', causality_checked: false,
        a: { kind: 'finance_target_state', ref: SPEND_REF, desire: 'favorable', current: { value: uah('3000') } },
        b: { kind: 'payoff_after_planned_date', desire: 'unfavorable', planned_payoff_date: '2027-06-30', projected_payoff_date: '2027-08-13' } }], truncated: false },
      consequences: {
        expenses: [{
          ref: TX_REF, context_ref: `context|${EXPENSE_CTX}`, transaction_id: 't1',
          expense: { amount: uah('180.00'), date: '2026-09-10', category_id: 'entertainment' },
          context: { plannedness: 'unplanned', funding_source: 'credit', purpose: 'Концерт', motive: null,
            emotional_context: 'напряжённая неделя', worth_it: null, expected_recurrence: 'recurring', recurrence_per_month: '2',
            obligation_entity_id: OBLIGATION },
          context_version: 1,
          impacts: [
            impact('repeat_scenario', 'computed', { result: { monthly: uah('360.00'), twelve_months: uah('4320.00') },
              assumptions: ['same_amount_each_time'], calculation: { formula: 'amount × recurrence_per_month; × 12' } }),
            impact('debt_projection', 'computed', {
              result: { a_as_entered: { state: 'paid_off', payoff_date: '2027-08-09' }, b_with_this_expense: { state: 'paid_off', payoff_date: '2027-08-13' },
                c_if_repeated: { state: 'paid_off', payoff_date: '2027-11-13' }, delta_days_b: 4, delta_days_c: 96 },
              assumptions: ['fixed_monthly_payment', 'fixed_annual_rate', 'no_other_new_borrowing'],
              inputs: [{ name: 'outstanding', value: uah('20000.00'), source: 'user', ref: `context|${OBLIGATION}` }],
              calculation: { formula: 'B(k+1) = B(k)·(1 + rate/12) + added − payment' } }),
            impact('reserve_projection', 'not_applicable', { limitations: ['funding_credit'] }),
            impact('budget_deviation', 'needs_input', { missing_inputs: ['target_or_expectation'] }),
          ],
          priority: null,
          attention: [{ flag: 'unplanned_credit_funded', conditions: [{ field: 'plannedness', value: 'unplanned' }, { field: 'funding_source', value: 'credit' }] }],
          missing_inputs: ['target_or_expectation'],
        }],
        position: { obligations: [{ entity_id: OBLIGATION, ref: `context|${OBLIGATION}`, label: 'Кредитная карта', currency: 'UAH',
          outstanding: '20000.00', monthly_payment: '2000.00', annual_rate_percent: '24', as_of: '2026-09-01' }],
        reserves: [], essentials: [], income: 'not_modeled', missing_inputs: ['reserve', 'essentials'] },
        priorities: [],
        self_check: { offered: true, highlighted: true, entity_id: null, result: null },
        unplanned_count: 1, contexts_without_transaction: 0, funding_summary: null,
      },
      relations: { items: [{ id: 'd1d2d3d4-0000-4000-8000-000000000009', source: 'user', family: null, rule_version: null, proposal_key: null,
        from: { key: TX_REF, domain: 'finance' }, to: { key: 'redacted', domain: 'observation', redacted: true },
        relation_type: 'related', epistemic_kind: 'association', status: 'approved', note: 'совпало с переездом', period: '2026-09',
        proposed_at: null, responded_at: null, evidence: [], endpoint_redacted: true, evidence_changed_since_response: null,
        revisit_eligible: false, history: [] }], truncated: false },
      requires_confirmation: { count: 1, items: [candidate], truncated: false },
      quality: { items: [{ kind: 'income_not_modeled', period: '2026-09' }] },
    },
    linkable: [{ ref: SPEND_REF, domain: 'finance', kind: 'finance_target_state', details: {} },
      { ref: TX_REF, domain: 'finance', kind: 'expense', details: { transaction_id: 't1' } }],
    importance: { [SPEND_REF]: { importance: 'matters', recorded_at: '2026-10-01T00:00:00Z' } },
    ...overrides,
  };
}

const life = { transactions: [{ id: 't1', amount: 180, date: '2026-09-10', description: 'Концерт', category_id: 'entertainment' }], projects: [] };
const actions = { busy: false, error: null, enqueue: () => {}, setImportance: () => {}, respond: () => {}, discard: () => {} };
const noPending = pendingIndex([]);

function reviewView(data = review(), extra = {}, locale = 'ru') {
  const names = buildLookup(data, life);
  return render(<ReviewView review={data} error={null} period="2026-09" tab="review"
    waiting={{ review_available: { count: 2, items: [] }, requires_confirmation: { count: 1, items: [] } }}
    names={names} life={life} pending={noPending} actions={actions} narrow={false} analytics={null} {...extra} />, locale);
}

describe('System Review view', () => {
  it('renders every section with the "not a verdict" framing and no score', () => {
    const html = reviewView();
    for (const text of ['Это не вердикт.', 'Что менялось', 'Что улучшилось', 'Что повторилось',
      'Противоречия и компромиссы', 'Последствия', 'Связи', 'Требует подтверждения · 1', 'Качество данных', 'Ваши выводы']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('Ревью доступно · 2');
    expect(html).not.toMatch(/балл[^а]|score|\/100/i);
    expect(html).toContain('против вашей цели');
    expect(html).toContain('ваша цель ₴4,000');
  });

  it('keeps missing as missing and a hypothesis visibly a hypothesis', () => {
    const html = reviewView();
    expect(html).toContain('прошлый месяц: нет данных');
    expect(html).toContain('гипотеза');
    expect(html).toContain('Почему предложено:');
    expect(html).toContain('запланированность: незапланировано');
    expect(html).toContain('Раньше по этому правилу вы: подтвердили 2, отклонили 1, не уверены 0');
    expect(html).toContain('Подтвердить');
    expect(html).toContain('Не связано');
    expect(html).toContain('Не уверен');
    expect(html).toContain('источник удалён');
    expect(html).toContain('Совпадение по времени есть, причинная связь не проверялась');
  });

  it('S7-30/31 · a projection shows its assumptions under the result; missing input reads «нужен ввод»', () => {
    const html = reviewView();
    expect(html).toContain('Проекция погашения долга');
    expect(html).toContain('сдвиг из-за этого расхода');
    expect(html).toContain('+4');
    expect(html).toContain('+96');
    expect(html).toContain('платёж каждый месяц одинаковый');
    expect(html).toContain('ставка не меняется');
    expect(html).toContain('Нужен ввод:');
    expect(html).toContain('цель или ожидание на месяц');
    expect(html).toContain('₴360');
    expect(html).toContain('Незапланированный расход оплачен кредитом или в долг');
    expect(html).toContain('Доход в JENKIN не моделируется');
    expect(html).not.toMatch(/плох|хорош|безответствен/);
  });

  it('S7-33/34 · the self-check says it is not a clinical test', () => {
    const html = reviewView();
    expect(html).toContain('Самопроверка JENKIN');
    expect(html).toContain('не клинический тест');
    expect(html).not.toMatch(/диагноз|саботаж|расстройств/);
  });

  it('a saved self-check shows the exact answers that raised its note', () => {
    const data = review();
    data.sections.consequences.self_check = { offered: true, highlighted: false, entity_id: EXPENSE_CTX, result: {
      questionnaire: 'lifeos_debt_selfcheck_v1', not_clinical: true, questions: Array(7).fill('q'),
      answers: { q_repayment_plan: 'no', q_new_spend_on_credit: 'yes' }, answered: 2,
      rule: { threshold: 2, indicators: {} }, flag: 'repayment_friction_pattern_worth_reviewing',
      triggered_by: [{ question: 'q_repayment_plan', answer: 'no' }, { question: 'q_new_spend_on_credit', answer: 'yes' }] } };
    const html = reviewView(data);
    expect(html).toContain('Есть конкретный план погашения?');
    expect(html).toContain('Возможно, есть повторяющееся затруднение с погашением');
    expect(html).toContain('отметка появляется при 2 и более индикаторах из 7');
    expect(html).not.toContain('aa_sr_');
    expect(html).toContain('покрытие неизвестно');
    expect(html).not.toContain('частичные данные');
  });

  it('a pending answer is shown as pending and not as answered', () => {
    const pending = pendingIndex([{ queue_id: 1, state: 'pending', operation_type: 'relation.respond',
      route: '/api/v1/aa/relations/proposals/respond', payload: { proposal_key: candidate.proposal_key, response: 'approved' } }]);
    const html = render(<ProposalCard candidate={candidate} names={buildLookup(review(), life)} pending={pending} actions={actions} evaluatedAt="now" />);
    expect(html).toContain('ждёт отправки — пока не учтён');
    expect(html).not.toContain('>Подтвердить<');
    const counted = reviewView(review(), { pending });
    expect(counted).toContain('Требует подтверждения · 1');
    expect(counted).toContain('Есть записи, ещё не подтверждённые сервером: 1');
  });

  it('finalizing waits for the period to end; «Вывода нет» is a valid end', () => {
    const running = reviewView(review({ period_state: 'in_progress', status: 'IN_PROGRESS' }));
    expect(running).toContain('Завершить обзор можно после окончания периода.');
    expect(running).toMatch(/<button[^>]*disabled=""[^>]*>завершить обзор<\/button>/);
    expect(running).toContain('Вывода нет — оставить как наблюдение');
    expect(running).toContain('Ничего не выбрано — это нормальный итог.');
  });

  it('the trade-off tab juxtaposes without an overall number', () => {
    const names = buildLookup(review(), life);
    const html = render(<ReviewView review={review()} period="2026-09" tab="tradeoff" waiting={null} names={names}
      life={life} pending={noPending} actions={actions} narrow analytics={null} />);
    expect(html).toContain('Общего балла нет и не будет.');
    expect(html).toContain('Что менялось одновременно');
    expect(html).toContain('aa-narrow');
    expect(html).toContain('одновременно');
  });

  it('S7-37 · Ukrainian copy renders without Russian-only letters', () => {
    const html = reviewView(review(), {}, 'uk');
    expect(html).toContain('Це не вердикт.');
    expect(html).toContain('Що змінювалося');
    expect(html).toContain('гіпотеза');
    expect(html).toContain('Потребує підтвердження · 1');
    const copy = html.replace(/Кредитная карта|совпало с переездом|напряжённая неделя|Концерт/g, '');
    expect(copy.replace(/<[^>]+>/g, ' ')).not.toMatch(/[ыэъё]/i);
  });
});

describe('«Связать», importance, revision and waiting views', () => {
  it('offers ten non-causal relation types, hypotheses marked, default «связано»', () => {
    const html = render(<LinkDialog from={TX_REF} review={review()} names={buildLookup(review(), life)} onClose={() => {}} onSave={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect((html.match(/<option value="(related|temporally_associated|co_occurs_with|conflicts_with|supports|preceded_by|followed_by|may_contribute_to|may_increase_risk_of|may_reduce_probability_of)"/g) ?? [])).toHaveLength(10);
    expect(html).toContain('может влиять на · гипотеза');
    expect(html).not.toMatch(/value="caus/);
    expect(html).toContain('Причинных связей здесь нет');
  });

  it('importance is a word menu, never a number', () => {
    const html = render(<AAImportance value="matters" onChange={() => {}} label="x" />);
    expect(html).toContain('для меня важно');
    expect(html).not.toMatch(/\d/);
  });

  it('a saved revision shows the user words first and «источник удалён» in place', () => {
    const revision = {
      period: '2026-09', period_kind: 'month', timezone: 'Europe/Kyiv', revision: 2, status: 'finalized',
      created_at: '2026-10-02T10:00:00Z', finalized_at: '2026-10-02T10:00:00Z', context_as_of: '2026-10-02T10:00:00Z',
      reflection: 'Мой вывод', no_conclusion: false, decisions: ['Записывать траты'], adjustments: [], redacted_at: '2026-10-05T10:00:00Z',
      live_sources_changed: true,
      frozen: { sections: { changed: [{ ordinal: 1, section: 'changed', kind: 'finance_target_state', redacted: true }],
        consequences: { expenses: [], position: [] }, relations: [] } },
    };
    const html = render(<RevisionView revision={revision} period="2026-09" number={2} life={life} narrow={false} />);
    expect(html.indexOf('Мой вывод')).toBeLessThan(html.indexOf('источник удалён'));
    expect(html).toContain('часть источников удалена');
    expect(html).toContain('Живой обзор уже другой');
    for (const format of ['PDF', 'DOCX', 'XLSX', 'MD']) expect(html).toContain(`>${format}<`);
  });

  it('«Ждёт вас» keeps review-available and requires-confirmation separate', () => {
    const waiting = {
      evaluated_at: 'now', timezone: 'Europe/Kyiv',
      review_available: { count: 2, items: [{ kind: 'experiment', experiment_id: 'e1', title: 'Экран до 23:00' }, { kind: 'monthly_review', period: '2026-09' }] },
      requires_confirmation: { count: 1, items: [candidate], horizon_months: 3 },
    };
    const html = render(<WaitingView waiting={waiting} pending={noPending} actions={actions} names={buildLookup(null, life)} />);
    expect(html).toContain('Ревью доступно · 2');
    expect(html).toContain('Требует подтверждения · 1');
    expect(html).toContain('href="#/experiment/e1"');
    expect(html).toContain('href="#/system-review/2026-09"');
    expect(html).toContain('за последние 3 мес.');
  });

  it('formats refs and deltas in their own unit', () => {
    const t = LifeMakeT('ru');
    const names = buildLookup(review(), life);
    expect(refText(TX_REF, names, t)).toBe('Концерт · ₴180');
    expect(refText('redacted', names, t)).toBe('источник удалён');
    expect(deltaText({ state: 'known', value: { type: 'duration', unit_code: 'minute', num: '7200' } }, t)).toBe('+5 дней');
    expect(deltaText({ state: 'known', type: 'duration', unit_code: 'minute', num: '-1440' }, t)).toBe('−1 день');
    expect(deltaText({ state: 'unknown' }, t)).toBe('разница неизвестна');
  });

  it('is one analytics-gated lazy route with a Sidebar entry', () => {
    expect(LIFE_ROUTES.has('system-review')).toBe(true);
    expect(typeof LAZY_ROUTE_LOADERS['system-review']).toBe('function');
    const t = LifeMakeT('ru');
    const html = renderToStaticMarkup(<LifeLocaleContext.Provider value={{ t, locale: 'ru' }}>
      <Sidebar route="system-review" onNav={() => {}} collapsed={false} setCollapsed={() => {}} analyticsEnabled />
    </LifeLocaleContext.Provider>);
    expect(html).toContain('обзор системы');
    expect(LifeStrings.uk.nav_system_review).toBe('огляд системи');
  });
});
