/* Experiment · create. The claim (hypothesis, intervention, window, outcome
   definition) is fixed once saved; a different attempt is a new experiment. */

import React from 'react';
import { MAX_WINDOW_DAYS, addDays, localToday, windowEndFor } from '../../../analytics/experimentFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';

const NUMBER = /^-?\d+(?:[.,]\d{1,6})?$/;

function initialValues() {
  const start = localToday();
  return {
    title: '', hypothesis: '', intervention: '',
    windowStart: start, length: '14',
    outcomeLabel: '', outcomeType: 'duration', currency: 'UAH', scaleMin: '1', scaleMax: '10',
    baselineValue: '', baselineStart: addDays(start, -14), baselineEnd: addDays(start, -1),
    startNow: false,
  };
}

/** Client-side checks for immediate feedback only; the server re-validates everything. */
export function validateCreate(values) {
  const errors = {};
  for (const field of ['title', 'hypothesis', 'intervention', 'outcomeLabel']) {
    if (!values[field].trim()) errors[field] = 'aa_ex_err_required';
  }
  const length = Number(values.length);
  if (!Number.isInteger(length) || length < 1 || length > MAX_WINDOW_DAYS) errors.length = 'aa_ex_err_length';
  if (values.outcomeType === 'scale'
    && !(NUMBER.test(values.scaleMin) && NUMBER.test(values.scaleMax)
      && Number(values.scaleMin.replace(',', '.')) < Number(values.scaleMax.replace(',', '.')))) {
    errors.scale = 'aa_ex_err_scale';
  }
  if (values.outcomeType === 'money' && !/^[A-Z]{3}$/.test(values.currency)) errors.currency = 'aa_ex_err_currency';
  if (values.baselineValue.trim()) {
    if (!NUMBER.test(values.baselineValue.trim())) errors.baselineValue = 'aa_ex_err_number';
    if (!(values.baselineStart <= values.baselineEnd && values.baselineEnd < values.windowStart)) {
      errors.baselineWindow = 'aa_ex_err_baseline_window';
    }
  }
  return errors;
}

export function outcomeDefinition(values) {
  const label = values.outcomeLabel.trim();
  if (values.outcomeType === 'duration') return { label, value_type: 'duration', unit_code: 'minute' };
  if (values.outcomeType === 'money') return { label, value_type: 'money', unit_code: values.currency };
  if (values.outcomeType === 'scale') {
    return { label, value_type: 'scale', scale_min: values.scaleMin.replace(',', '.'),
      scale_max: values.scaleMax.replace(',', '.') };
  }
  return { label, value_type: 'count' };
}

function Field({ id, label, error, t, children }) {
  return <div className="aa-field">
    <label className="aa-eyebrow" htmlFor={id}>{label}</label>
    {children}
    {error ? <span className="aa-exp-error" role="alert" id={`${id}-error`}>{t(error)}</span> : null}
  </div>;
}

export function CreateForm({ onCreate, canCreate = true, busy = false }) {
  const t = useAAText();
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState({});
  const set = field => event => setValues(previous => ({
    ...previous, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
  }));
  const windowEnd = Number.isInteger(Number(values.length)) && Number(values.length) >= 1
    ? windowEndFor(values.windowStart, Number(values.length)) : null;

  function submit(event) {
    event.preventDefault();
    const found = validateCreate(values);
    setErrors(found);
    if (Object.keys(found).length || !canCreate) return;
    onCreate({ ...values, windowEnd: windowEndFor(values.windowStart, Number(values.length)),
      outcome: outcomeDefinition(values) });
  }

  const describedBy = (field, id) => (errors[field] ? `${id}-error` : undefined);
  return <form className="card panel aa-section aa-exp-form" onSubmit={submit} noValidate>
    <p className="aa-quiet">{t('aa_ex_create_hint')}</p>
    <Field id="exp-title" label={t('aa_ex_f_title')} error={errors.title} t={t}>
      <input id="exp-title" className="aa-input" maxLength={200} value={values.title} onChange={set('title')}
        aria-invalid={Boolean(errors.title)} aria-describedby={describedBy('title', 'exp-title')} />
    </Field>
    <Field id="exp-hypothesis" label={t('aa_ex_f_hypothesis')} error={errors.hypothesis} t={t}>
      <textarea id="exp-hypothesis" className="aa-textarea" maxLength={1000} value={values.hypothesis}
        placeholder={t('aa_ex_f_hypothesis_ph')} onChange={set('hypothesis')}
        aria-invalid={Boolean(errors.hypothesis)} aria-describedby={describedBy('hypothesis', 'exp-hypothesis')} />
    </Field>
    <Field id="exp-intervention" label={t('aa_ex_f_intervention')} error={errors.intervention} t={t}>
      <textarea id="exp-intervention" className="aa-textarea" maxLength={1000} value={values.intervention}
        onChange={set('intervention')} aria-invalid={Boolean(errors.intervention)}
        aria-describedby={describedBy('intervention', 'exp-intervention')} />
    </Field>
    <div className="aa-exp-row">
      <Field id="exp-start" label={t('aa_ex_f_window_start')} t={t}>
        <input id="exp-start" type="date" className="aa-input" value={values.windowStart} onChange={set('windowStart')} />
      </Field>
      <Field id="exp-length" label={t('aa_ex_f_length')} error={errors.length} t={t}>
        <input id="exp-length" type="number" min="1" max={MAX_WINDOW_DAYS} className="aa-input" value={values.length}
          onChange={set('length')} aria-invalid={Boolean(errors.length)} aria-describedby={describedBy('length', 'exp-length')} />
      </Field>
    </div>
    {windowEnd ? <p className="aa-quiet">{t('aa_ex_f_window_end', windowEnd)}</p> : null}
    <fieldset className="aa-exp-fieldset">
      <legend className="aa-eyebrow">{t('aa_ex_f_outcome')}</legend>
      <Field id="exp-outcome-label" label={t('aa_ex_f_outcome_label')} error={errors.outcomeLabel} t={t}>
        <input id="exp-outcome-label" className="aa-input" maxLength={200} value={values.outcomeLabel}
          placeholder={t('aa_ex_f_outcome_label_ph')} onChange={set('outcomeLabel')}
          aria-invalid={Boolean(errors.outcomeLabel)} aria-describedby={describedBy('outcomeLabel', 'exp-outcome-label')} />
      </Field>
      <Field id="exp-outcome-type" label={t('aa_ex_f_outcome_type')} t={t}>
        <select id="exp-outcome-type" className="aa-input" value={values.outcomeType} onChange={set('outcomeType')}>
          {['duration', 'count', 'scale', 'money'].map(type => <option key={type} value={type}>{t(`aa_ex_type_${type}`)}</option>)}
        </select>
      </Field>
      {values.outcomeType === 'scale' ? <div className="aa-exp-row">
        <Field id="exp-scale-min" label={t('aa_ex_f_scale_min')} error={errors.scale} t={t}>
          <input id="exp-scale-min" className="aa-input" inputMode="decimal" value={values.scaleMin} onChange={set('scaleMin')} />
        </Field>
        <Field id="exp-scale-max" label={t('aa_ex_f_scale_max')} t={t}>
          <input id="exp-scale-max" className="aa-input" inputMode="decimal" value={values.scaleMax} onChange={set('scaleMax')} />
        </Field>
      </div> : null}
      {values.outcomeType === 'money' ? <Field id="exp-currency" label={t('aa_ex_f_currency')} error={errors.currency} t={t}>
        <input id="exp-currency" className="aa-input" maxLength={3} value={values.currency}
          onChange={event => setValues(previous => ({ ...previous, currency: event.target.value.toUpperCase() }))} />
      </Field> : null}
    </fieldset>
    <fieldset className="aa-exp-fieldset">
      <legend className="aa-eyebrow">{t('aa_ex_f_baseline')}</legend>
      <p className="aa-quiet">{t('aa_ex_f_baseline_hint')}</p>
      <Field id="exp-baseline" label={t('aa_ex_f_baseline_value')} error={errors.baselineValue} t={t}>
        <input id="exp-baseline" className="aa-input" inputMode="decimal" value={values.baselineValue}
          onChange={set('baselineValue')} aria-invalid={Boolean(errors.baselineValue)} />
      </Field>
      <div className="aa-exp-row">
        <Field id="exp-baseline-start" label={t('aa_ex_f_baseline_from')} error={errors.baselineWindow} t={t}>
          <input id="exp-baseline-start" type="date" className="aa-input" value={values.baselineStart} onChange={set('baselineStart')} />
        </Field>
        <Field id="exp-baseline-end" label={t('aa_ex_f_baseline_to')} t={t}>
          <input id="exp-baseline-end" type="date" className="aa-input" value={values.baselineEnd} onChange={set('baselineEnd')} />
        </Field>
      </div>
    </fieldset>
    <label className="aa-exp-check">
      <input type="checkbox" checked={values.startNow} onChange={set('startNow')} />
      <span>{t('aa_ex_f_start_now')}</span>
    </label>
    <div className="aa-actions">
      <a className="aa-link" href="#/experiment">{t('aa_ex_cancel')}</a>
      <button type="submit" className="aa-btn aa-btn-primary" disabled={!canCreate || busy}>{t('aa_ex_create')}</button>
    </div>
  </form>;
}
