/* Review · the five-step new-Review flow and the shared choice / factor editors. */

import React from 'react';
import AAFactorTag from '../../../components/analytics/AAFactorTag.jsx';
import AAHistoryList from '../../../components/analytics/AAHistoryList.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { REVIEW_CHOICES, REVIEW_STEPS, openReviewHash, reviewSaveRequest } from '../../../analytics/review';
import { CHOICE_KEYS, eyebrow, formatInstant } from './format.js';
import { Alongside, ReviewEvidence, evidenceHistory } from './Evidence.jsx';

/** Single-select sentences. `undefined` (in revise mode) means «leave as is». */
function ChoiceList({ value, onChange, allowUnchanged = false, name }) {
  const t = useAAText();
  const options = [
    ...(allowUnchanged ? [[undefined, t('aa_rv_decision_keep_current')]] : []),
    ...REVIEW_CHOICES.map(choice => [choice, t(CHOICE_KEYS[choice])]),
    [null, t('aa_rv_choice_none')],
  ];
  return <div className="aa-choice" role="radiogroup" aria-label={t('aa_rv_decision')}>
    {options.map(([choice, label]) => {
      const on = value === choice;
      return <button type="button" role="radio" aria-checked={on} key={`${name}-${String(choice)}`}
        className={`aa-choice-btn${on ? ' is-on' : ''}`} onClick={() => onChange(choice)}>{label}</button>;
    })}
  </div>;
}

function FactorEditor({ factors, onChange, idPrefix }) {
  const t = useAAText();
  const [text, setText] = React.useState('');
  const keyRef = React.useRef(0);
  function add(event) {
    event.preventDefault();
    if (!text.trim()) return;
    keyRef.current += 1;
    onChange([...factors, { key: `${idPrefix}-${keyRef.current}`, text: text.trim(), epistemic_kind: 'unknown' }]);
    setText('');
  }
  return <div className="aa-col">
    {factors.map(factor => <div className="aa-factor" key={factor.key}>
      <span className="aa-factor-text">{factor.text}</span>
      <AAFactorTag kind={factor.epistemic_kind}
        onChange={kind => onChange(factors.map(item => (item.key === factor.key ? { ...item, epistemic_kind: kind } : item)))}
        onRemove={() => onChange(factors.filter(item => item.key !== factor.key))} />
    </div>)}
    <form className="aa-factor-add" onSubmit={add}>
      <input className="aa-input" value={text} maxLength={500} aria-label={t('aa_rv_factor_label')}
        placeholder={t('aa_rv_factor_placeholder')} onChange={event => setText(event.target.value)} />
      <button type="submit" className="aa-tag" data-kind="unknown">{t('aa_rv_factor_add')}</button>
    </form>
    <div className="aa-none">{t('aa_rv_unknown_ok')}</div>
  </div>;
}

const STEP_COPY = {
  compare: ['aa_rv_q1', 'aa_rv_h1'],
  note: ['aa_rv_q2', 'aa_rv_h2'],
  factors: ['aa_rv_q3', 'aa_rv_h3'],
  alongside: ['aa_rv_q4', 'aa_rv_h4'],
  decision: ['aa_rv_q5', 'aa_rv_h5'],
};

/** A new Review: every step optional, «пропустить» always on the left. */
export function ReviewFlow({ context, projects, onSave, narrow = false, initialStep = 0, earlier = [] }) {
  const t = useAAText();
  const [step, setStep] = React.useState(initialStep);
  const [note, setNote] = React.useState('');
  const [factors, setFactors] = React.useState([]);
  const [decision, setDecision] = React.useState(undefined);
  const [status, setStatus] = React.useState({ saved: false, error: null, busy: false });
  const heading = React.useRef(null);
  const firstRender = React.useRef(true);
  const noteId = React.useId();

  React.useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step]);

  async function save() {
    if (status.busy) return;
    setStatus({ saved: false, error: null, busy: true });
    try {
      await onSave(reviewSaveRequest(context, { note, factors, decision }));
      setStatus({ saved: true, error: null, busy: false });
    } catch {
      setStatus({ saved: false, error: t('aa_rv_save_failed'), busy: false });
    }
  }

  const last = step === REVIEW_STEPS.length - 1;
  const advance = () => (last ? void save() : setStep(step + 1));

  if (status.saved) {
    return <div className="aa-review-card" aria-live="polite">
      <div className="aa-eyebrow aa-eyebrow-strong">{t('aa_rv_saved_eyebrow')}</div>
      <h2 className="aa-q">{t('aa_rv_saved_title')}</h2>
      <div className="aa-help">{t('aa_rv_saved_help')}</div>
      <p className="aa-quiet">{t('aa_rv_queued')}</p>
      <AAHistoryList facts={evidenceHistory(context.items, t)} narrow={narrow} />
    </div>;
  }

  const key = REVIEW_STEPS[step];
  const [question, help] = STEP_COPY[key];
  return <div className="aa-col">
    <div className="aa-review-head">
      <div className="aa-eyebrow">{eyebrow(context.subject_key, t, projects)}</div>
      <div className="aa-steps" aria-hidden="true">
        {REVIEW_STEPS.map((name, index) => <span key={name}
          className={`aa-step-dot${index === step ? ' is-on' : index < step ? ' is-done' : ''}`} />)}
      </div>
    </div>
    <div>
      <p className="aa-sr-only" aria-live="polite">{t('aa_rv_step_of', step + 1, REVIEW_STEPS.length)}</p>
      <h2 className="aa-q" tabIndex={-1} ref={heading}>{t(question)}</h2>
      <div className="aa-help">{t(help)}</div>
    </div>
    <div data-review-step={key}>
      {key === 'compare' ? <ReviewEvidence items={context.items} narrow={narrow} /> : null}
      {key === 'note' ? <div className="aa-field">
        <label className="aa-sr-only" htmlFor={noteId}>{t('aa_rv_note_label')}</label>
        <textarea id={noteId} className="aa-textarea" value={note} maxLength={4000}
          placeholder={t('aa_rv_note_placeholder')} onChange={event => setNote(event.target.value)} />
        <span className="aa-quiet">{t('aa_rv_note_hint')}</span>
      </div> : null}
      {key === 'factors' ? <FactorEditor factors={factors} onChange={setFactors} idPrefix="new" /> : null}
      {key === 'alongside' ? <Alongside items={context.items} narrow={narrow} /> : null}
      {key === 'decision' ? <ChoiceList value={decision} onChange={setDecision} name="new" /> : null}
    </div>
    {status.error ? <p className="auth-error" role="alert">{status.error}</p> : null}
    <div className="aa-actions">
      <button type="button" className="aa-btn aa-btn-ghost" onClick={advance} disabled={status.busy}>{t('aa_rv_skip')}</button>
      <div className="aa-actions-right">
        {step > 0 ? <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setStep(step - 1)}>{t('aa_rv_back')}</button> : null}
        <button type="button" className="aa-btn aa-btn-primary" onClick={advance} disabled={status.busy}>
          {last ? t('aa_rv_save') : t('aa_rv_next')}
        </button>
      </div>
    </div>
    {earlier.length ? <section className="aa-col" aria-label={t('aa_rv_earlier')}>
      <div className="aa-eyebrow">{t('aa_rv_earlier')}</div>
      <ul className="aa-review-list">
        {earlier.map(row => <li key={row.id} className="aa-tradeoff">
          <span>{t('aa_rv_created', formatInstant(row.created_at, t))}{row.revised_at ? ` · ${t('aa_rv_revised', formatInstant(row.revised_at, t))}` : ''}</span>
          <a className="aa-link" href={openReviewHash(row.id)}>{t('aa_rv_open')}</a>
        </li>)}
      </ul>
    </section> : null}
  </div>;
}

export { ChoiceList, FactorEditor, STEP_COPY };
