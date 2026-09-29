/* System Review · «Самопроверка LifeOS» — a custom, transparent questionnaire,
   not a clinical or psychometric test. It can raise one attention note and
   always shows exactly which answers raised it and by what rule. */

import React from 'react';
import { SELF_CHECK_QUESTIONS, financeContextRequest } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';

const ANSWERS = ['yes', 'no', 'unknown', 'prefer_not'];

export function SelfCheck({ period, block, onSave, busy }) {
  const t = useAAText();
  const saved = block?.result;
  const [editing, setEditing] = React.useState(false);
  const [answers, setAnswers] = React.useState(saved?.answers ?? {});
  if (!block?.offered && !saved) return null;

  function submit(event) {
    event.preventDefault();
    onSave(financeContextRequest({
      kind: 'self_check',
      subjectKey: `finance:period:${period}`,
      entityId: block.entity_id ?? undefined,
      payload: { questionnaire: 'lifeos_debt_selfcheck_v1', answers },
    }));
    setEditing(false);
  }

  return <div className={`aa-sr-selfcheck${block.highlighted ? ' is-highlighted' : ''}`}>
    <div className="aa-section-head">
      <h4 className="aa-sr-form-title">{t('aa_sr_selfcheck_title')}</h4>
      <span className="aa-tag" data-kind="unknown">{t('aa_sr_selfcheck_not_clinical')}</span>
    </div>
    <p className="aa-quiet">{t('aa_sr_selfcheck_intro')}</p>
    {block.highlighted && !saved ? <p className="aa-quiet">{t('aa_sr_selfcheck_highlighted')}</p> : null}
    {saved && !editing ? <div className="aa-col">
      <p className="aa-sr-text">{saved.flag ? t('aa_sr_selfcheck_flag') : t('aa_sr_selfcheck_no_flag')}</p>
      {saved.triggered_by.length ? <ul className="aa-sr-conditions">
        {saved.triggered_by.map(entry => <li key={entry.question}>
          {t(`aa_sr_${entry.question}`)} — <b>{t(`aa_sr_ans_${entry.answer}`)}</b>
        </li>)}
      </ul> : null}
      <p className="aa-quiet">{t('aa_sr_selfcheck_rule', saved.rule.threshold, saved.questions.length)}</p>
      <div className="aa-actions-right">
        <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setEditing(true)}>{t('aa_sr_selfcheck_edit')}</button>
      </div>
    </div> : null}
    {!saved && !editing ? <div className="aa-actions-right">
      <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setEditing(true)}>{t('aa_sr_selfcheck_start')}</button>
    </div> : null}
    {editing ? <form className="aa-col" onSubmit={submit} aria-label={t('aa_sr_selfcheck_title')}>
      {SELF_CHECK_QUESTIONS.map(question => <fieldset className="aa-exp-fieldset" key={question}>
        <legend className="aa-sr-text">{t(`aa_sr_${question}`)}</legend>
        <div className="aa-choice aa-sr-choice-row" role="radiogroup" aria-label={t(`aa_sr_${question}`)}>
          {ANSWERS.map(answer => <button type="button" role="radio" key={answer}
            aria-checked={answers[question] === answer}
            className={`aa-choice-btn${answers[question] === answer ? ' is-on' : ''}`}
            onClick={() => setAnswers(previous => ({ ...previous, [question]: answer }))}>
            {t(`aa_sr_ans_${answer}`)}
          </button>)}
        </div>
      </fieldset>)}
      <div className="aa-actions">
        <span className="aa-quiet">{t('aa_sr_selfcheck_optional')}</span>
        <span className="aa-actions-right">
          <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setEditing(false)}>{t('aa_sr_cancel')}</button>
          <button type="submit" className="aa-btn aa-btn-primary" disabled={busy}>{t('aa_sr_save')}</button>
        </span>
      </div>
    </form> : null}
  </div>;
}
