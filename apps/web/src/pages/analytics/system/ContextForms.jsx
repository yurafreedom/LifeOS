/* System Review · explicit finance context. Nothing here is inferred: every
   field is optional unless a projection cannot be stated without it, and
   «не знаю» is a real answer. Free text is the user's own words; it is stored
   because they typed it and is never copied into a relation or proposal. */

import React from 'react';
import { FUNDING_SOURCES, financeContextRequest } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';

const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const RATE = /^\d{1,3}(\.\d{1,3})?$/;
const COUNT = /^\d{1,2}(\.\d{1,2})?$/;

export function decimalInput(value) {
  return String(value ?? '').trim().replace(',', '.').replace(/\s/g, '');
}

function todayKyiv() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
}

function Field({ label, children, hint }) {
  return <label className="aa-field">
    <span className="aa-quiet">{label}</span>
    {children}
    {hint ? <span className="aa-quiet aa-sr-hint">{hint}</span> : null}
  </label>;
}

function Choice({ name, value, options, onChange, legend }) {
  return <fieldset className="aa-exp-fieldset">
    <legend className="aa-quiet">{legend}</legend>
    <div className="aa-choice aa-sr-choice-row" role="radiogroup" aria-label={legend}>
      {options.map(([option, label]) => <button type="button" role="radio" key={option || 'none'}
        aria-checked={value === option} name={name}
        className={`aa-choice-btn${value === option ? ' is-on' : ''}`} onClick={() => onChange(option)}>
        {label}
      </button>)}
    </div>
  </fieldset>;
}

function FormShell({ title, onCancel, onSubmit, error, children, busy }) {
  const t = useAAText();
  return <form className="aa-exp-form aa-sr-form" onSubmit={onSubmit} aria-label={title}>
    <h4 className="aa-sr-form-title">{title}</h4>
    {children}
    {error ? <p className="aa-exp-error" role="alert">{error}</p> : null}
    <div className="aa-actions">
      <span className="aa-quiet">{t('aa_sr_form_explicit')}</span>
      <span className="aa-actions-right">
        <button type="button" className="aa-btn aa-btn-ghost" onClick={onCancel}>{t('aa_sr_cancel')}</button>
        <button type="submit" className="aa-btn aa-btn-primary" disabled={busy}>{t('aa_sr_save')}</button>
      </span>
    </div>
  </form>;
}

export function ExpenseContextForm({ transactionId, entityId, initial = {}, obligations = [], onSave, onCancel, busy }) {
  const t = useAAText();
  const [values, setValues] = React.useState({
    plannedness: initial.plannedness ?? 'unknown',
    funding_source: initial.funding_source ?? 'unknown',
    obligation_entity_id: initial.obligation_entity_id ?? '',
    purpose: initial.purpose ?? '',
    motive: initial.motive ?? '',
    emotional_context: initial.emotional_context ?? '',
    worth_it: initial.worth_it ?? null,
    expected_recurrence: initial.expected_recurrence ?? 'unknown',
    recurrence_per_month: initial.recurrence_per_month ?? '',
  });
  const [error, setError] = React.useState(null);
  const set = name => value => setValues(previous => ({ ...previous, [name]: value }));
  const credit = ['credit', 'borrowed', 'mixed'].includes(values.funding_source);
  const repeats = ['occasional', 'recurring'].includes(values.expected_recurrence);

  function submit(event) {
    event.preventDefault();
    const frequency = decimalInput(values.recurrence_per_month);
    if (repeats && frequency && (!COUNT.test(frequency) || Number(frequency) <= 0 || Number(frequency) > 31)) {
      setError(t('aa_sr_err_frequency'));
      return;
    }
    onSave(financeContextRequest({
      kind: 'expense_context',
      subjectKey: `finance:transaction:${transactionId}`,
      entityId,
      payload: {
        plannedness: values.plannedness,
        funding_source: values.funding_source,
        obligation_entity_id: credit ? values.obligation_entity_id || null : null,
        purpose: values.purpose,
        motive: values.motive,
        emotional_context: values.emotional_context,
        worth_it: values.worth_it,
        expected_recurrence: values.expected_recurrence,
        recurrence_per_month: repeats && frequency ? frequency : null,
      },
    }));
  }

  return <FormShell title={t('aa_sr_expense_form')} onCancel={onCancel} onSubmit={submit} error={error} busy={busy}>
    <Choice legend={t('aa_sr_f_plannedness')} name="plannedness" value={values.plannedness} onChange={set('plannedness')}
      options={['planned', 'unplanned', 'unknown'].map(code => [code, t(`aa_sr_plan_${code}`)])} />
    <Field label={t('aa_sr_f_funding')}>
      <select className="aa-input" value={values.funding_source} onChange={event => set('funding_source')(event.target.value)}>
        {FUNDING_SOURCES.map(code => <option key={code} value={code}>{t(`aa_sr_fund_${code}`)}</option>)}
      </select>
    </Field>
    {credit ? <Field label={t('aa_sr_f_obligation')} hint={obligations.length ? t('aa_sr_f_obligation_hint') : t('aa_sr_f_no_obligation')}>
      <select className="aa-input" value={values.obligation_entity_id}
        onChange={event => set('obligation_entity_id')(event.target.value)}>
        <option value="">{t('aa_sr_not_specified')}</option>
        {obligations.map(item => <option key={item.entity_id} value={item.entity_id}>{item.label}</option>)}
      </select>
    </Field> : null}
    <Field label={t('aa_sr_f_purpose')}>
      <input className="aa-input" maxLength={300} value={values.purpose} onChange={event => set('purpose')(event.target.value)} />
    </Field>
    <Field label={t('aa_sr_f_motive')}>
      <textarea className="aa-textarea" maxLength={1000} value={values.motive} onChange={event => set('motive')(event.target.value)} />
    </Field>
    <Field label={t('aa_sr_f_emotional')} hint={t('aa_sr_f_emotional_hint')}>
      <textarea className="aa-textarea" maxLength={1000} value={values.emotional_context}
        onChange={event => set('emotional_context')(event.target.value)} />
    </Field>
    <Choice legend={t('aa_sr_f_worth_it')} name="worth_it" value={values.worth_it} onChange={set('worth_it')}
      options={[['yes', t('aa_sr_worth_yes')], ['no', t('aa_sr_worth_no')], ['unsure', t('aa_sr_worth_unsure')], [null, t('aa_sr_not_specified')]]} />
    <Field label={t('aa_sr_f_recurrence')}>
      <select className="aa-input" value={values.expected_recurrence}
        onChange={event => set('expected_recurrence')(event.target.value)}>
        {['unknown', 'one_off', 'occasional', 'recurring'].map(code => <option key={code} value={code}>{t(`aa_sr_recur_${code}`)}</option>)}
      </select>
    </Field>
    {repeats ? <Field label={t('aa_sr_f_per_month')}>
      <input className="aa-input" inputMode="decimal" value={values.recurrence_per_month}
        onChange={event => set('recurrence_per_month')(event.target.value)} />
    </Field> : null}
  </FormShell>;
}

function useDecimalForm(fields, initial) {
  const [values, setValues] = React.useState(() => Object.fromEntries(fields.map(([name, fallback]) =>
    [name, initial?.[name] ?? fallback])));
  const set = name => event => setValues(previous => ({ ...previous, [name]: event.target.value }));
  return [values, set];
}

export function ObligationForm({ entityId, initial, onSave, onCancel, busy }) {
  const t = useAAText();
  const [values, set] = useDecimalForm([
    ['label', ''], ['obligation_kind', 'credit_card'], ['currency', 'UAH'], ['outstanding', ''],
    ['monthly_payment', ''], ['annual_rate_percent', ''], ['as_of', todayKyiv()], ['planned_payoff_date', ''],
  ], initial);
  const [error, setError] = React.useState(null);
  function submit(event) {
    event.preventDefault();
    const outstanding = decimalInput(values.outstanding);
    const payment = decimalInput(values.monthly_payment);
    const rate = decimalInput(values.annual_rate_percent);
    if (!values.label.trim() || !MONEY.test(outstanding) || (payment && !MONEY.test(payment))
      || (rate && !RATE.test(rate)) || !/^[A-Z]{3}$/.test(values.currency) || !values.as_of) {
      setError(t('aa_sr_err_obligation'));
      return;
    }
    onSave(financeContextRequest({
      kind: 'obligation', entityId,
      payload: { ...values, outstanding, monthly_payment: payment || null, annual_rate_percent: rate || null,
        planned_payoff_date: values.planned_payoff_date || null },
    }));
  }
  return <FormShell title={t('aa_sr_obligation_form')} onCancel={onCancel} onSubmit={submit} error={error} busy={busy}>
    <Field label={t('aa_sr_f_label')}><input className="aa-input" maxLength={120} value={values.label} onChange={set('label')} /></Field>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_obligation_kind')}>
        <select className="aa-input" value={values.obligation_kind} onChange={set('obligation_kind')}>
          {['credit_card', 'loan', 'personal_debt', 'other'].map(code => <option key={code} value={code}>{t(`aa_sr_obk_${code}`)}</option>)}
        </select>
      </Field>
      <Field label={t('aa_sr_f_currency')}><input className="aa-input" maxLength={3} value={values.currency} onChange={set('currency')} /></Field>
    </div>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_outstanding')}><input className="aa-input" inputMode="decimal" value={values.outstanding} onChange={set('outstanding')} /></Field>
      <Field label={t('aa_sr_f_payment')} hint={t('aa_sr_f_optional_for_projection')}><input className="aa-input" inputMode="decimal" value={values.monthly_payment} onChange={set('monthly_payment')} /></Field>
    </div>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_rate')} hint={t('aa_sr_f_rate_hint')}><input className="aa-input" inputMode="decimal" value={values.annual_rate_percent} onChange={set('annual_rate_percent')} /></Field>
      <Field label={t('aa_sr_f_as_of')}><input className="aa-input" type="date" value={values.as_of} onChange={set('as_of')} /></Field>
    </div>
    <Field label={t('aa_sr_f_planned_payoff')} hint={t('aa_sr_f_planned_payoff_hint')}>
      <input className="aa-input" type="date" value={values.planned_payoff_date} onChange={set('planned_payoff_date')} />
    </Field>
  </FormShell>;
}

export function ReserveForm({ entityId, initial, onSave, onCancel, busy }) {
  const t = useAAText();
  const [values, set] = useDecimalForm([
    ['label', ''], ['currency', 'UAH'], ['amount', ''], ['threshold', ''], ['as_of', todayKyiv()],
  ], initial);
  const [error, setError] = React.useState(null);
  function submit(event) {
    event.preventDefault();
    const amount = decimalInput(values.amount);
    const threshold = decimalInput(values.threshold);
    if (!MONEY.test(amount) || (threshold && !MONEY.test(threshold)) || !/^[A-Z]{3}$/.test(values.currency) || !values.as_of) {
      setError(t('aa_sr_err_reserve'));
      return;
    }
    onSave(financeContextRequest({
      kind: 'reserve', entityId, payload: { ...values, amount, threshold: threshold || null },
    }));
  }
  return <FormShell title={t('aa_sr_reserve_form')} onCancel={onCancel} onSubmit={submit} error={error} busy={busy}>
    <Field label={t('aa_sr_f_label_optional')}><input className="aa-input" maxLength={120} value={values.label} onChange={set('label')} /></Field>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_amount')}><input className="aa-input" inputMode="decimal" value={values.amount} onChange={set('amount')} /></Field>
      <Field label={t('aa_sr_f_currency')}><input className="aa-input" maxLength={3} value={values.currency} onChange={set('currency')} /></Field>
    </div>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_threshold')} hint={t('aa_sr_f_threshold_hint')}><input className="aa-input" inputMode="decimal" value={values.threshold} onChange={set('threshold')} /></Field>
      <Field label={t('aa_sr_f_as_of')}><input className="aa-input" type="date" value={values.as_of} onChange={set('as_of')} /></Field>
    </div>
  </FormShell>;
}

export function EssentialsForm({ entityId, initial, onSave, onCancel, busy }) {
  const t = useAAText();
  const [values, set] = useDecimalForm([['currency', 'UAH'], ['monthly_amount', ''], ['as_of', todayKyiv()]], initial);
  const [error, setError] = React.useState(null);
  function submit(event) {
    event.preventDefault();
    const amount = decimalInput(values.monthly_amount);
    if (!MONEY.test(amount) || Number(amount) <= 0 || !/^[A-Z]{3}$/.test(values.currency) || !values.as_of) {
      setError(t('aa_sr_err_essentials'));
      return;
    }
    onSave(financeContextRequest({ kind: 'essentials', entityId, payload: { ...values, monthly_amount: amount } }));
  }
  return <FormShell title={t('aa_sr_essentials_form')} onCancel={onCancel} onSubmit={submit} error={error} busy={busy}>
    <div className="aa-exp-row">
      <Field label={t('aa_sr_f_monthly_essentials')}><input className="aa-input" inputMode="decimal" value={values.monthly_amount} onChange={set('monthly_amount')} /></Field>
      <Field label={t('aa_sr_f_currency')}><input className="aa-input" maxLength={3} value={values.currency} onChange={set('currency')} /></Field>
    </div>
    <Field label={t('aa_sr_f_as_of')}><input className="aa-input" type="date" value={values.as_of} onChange={set('as_of')} /></Field>
  </FormShell>;
}
