/* Experiment · «Что могло повлиять» and the user's decision. The Review
   ChoiceList is not reused: it hard-codes Review choices. Factors reuse
   AAFactorTag as is. A decision never changes the lifecycle. */

import React from 'react';
import { EXPERIMENT_CHOICES } from '../../../analytics/experimentFacts';
import AAFactorTag from '../../../components/analytics/AAFactorTag.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { CHOICE_KEYS } from './format.js';

export function ExperimentChoiceList({ value, onChange }) {
  const t = useAAText();
  const options = [...EXPERIMENT_CHOICES.map(choice => [choice, t(CHOICE_KEYS[choice])]), [null, t('aa_ex_choice_none')]];
  return <div className="aa-choice" role="radiogroup" aria-label={t('aa_ex_decision_title')}>
    {options.map(([choice, label]) => {
      const on = value === choice;
      return <button type="button" role="radio" aria-checked={on} key={String(choice)}
        className={`aa-choice-btn${on ? ' is-on' : ''}`} onClick={() => onChange(choice)}>{label}</button>;
    })}
  </div>;
}

/**
 * Current factors come from the server; edits are a diff (added, retracted,
 * re-tagged = retract + add with `replaces_id`) sent with the next save.
 */
export function DecisionStep({ decision, onSave, busy = false }) {
  const t = useAAText();
  const saved = decision.factors.filter(factor => factor.retracted_in_revision == null);
  const [choice, setChoice] = React.useState(decision.current?.choice ?? null);
  const [kinds, setKinds] = React.useState({});
  const [retracted, setRetracted] = React.useState([]);
  const [added, setAdded] = React.useState([]);
  const [text, setText] = React.useState('');
  const counter = React.useRef(0);

  function addFactor(event) {
    event.preventDefault();
    if (!text.trim()) return;
    counter.current += 1;
    setAdded(list => [...list, { key: `new-${counter.current}`, text: text.trim(), epistemic_kind: 'unknown' }]);
    setText('');
  }

  function save() {
    const retagged = saved.filter(factor => kinds[factor.id] && kinds[factor.id] !== factor.epistemic_kind
      && !retracted.includes(factor.id));
    onSave({
      choice,
      addFactors: [
        ...retagged.map(factor => ({ text: factor.text, epistemic_kind: kinds[factor.id], replaces_id: factor.id })),
        ...added.map(({ text: factorText, epistemic_kind }) => ({ text: factorText, epistemic_kind })),
      ],
      retractIds: [...retracted, ...retagged.map(factor => factor.id)],
    });
    setKinds({}); setRetracted([]); setAdded([]);
  }

  return <>
    <section className="card panel aa-section" aria-labelledby="exp-factors">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-factors">{t('aa_ex_factors_title')}</h3>
        <span className="aa-quiet">{t('aa_ex_factors_sub')}</span>
      </div>
      <div className="aa-col">
        {saved.filter(factor => !retracted.includes(factor.id)).map(factor => <div className="aa-factor" key={factor.id}>
          <span className="aa-factor-text">{factor.text}</span>
          <AAFactorTag kind={kinds[factor.id] ?? factor.epistemic_kind}
            onChange={kind => setKinds(map => ({ ...map, [factor.id]: kind }))}
            onRemove={() => setRetracted(list => [...list, factor.id])} />
        </div>)}
        {added.map(factor => <div className="aa-factor" key={factor.key}>
          <span className="aa-factor-text">{factor.text}</span>
          <AAFactorTag kind={factor.epistemic_kind}
            onChange={kind => setAdded(list => list.map(item => (item.key === factor.key ? { ...item, epistemic_kind: kind } : item)))}
            onRemove={() => setAdded(list => list.filter(item => item.key !== factor.key))} />
        </div>)}
        <form className="aa-factor-add" onSubmit={addFactor}>
          <input className="aa-input" value={text} maxLength={500} aria-label={t('aa_rv_factor_label')}
            placeholder={t('aa_rv_factor_placeholder')} onChange={event => setText(event.target.value)} />
          <button type="submit" className="aa-tag" data-kind="unknown">{t('aa_rv_factor_add')}</button>
        </form>
        <p className="aa-none">{t('aa_ex_factors_not_cause')}</p>
      </div>
    </section>
    <section className="card panel aa-section" aria-labelledby="exp-decision">
      <div className="aa-section-head">
        <h3 className="panel-title" id="exp-decision">{t('aa_ex_decision_title')}</h3>
        <span className="aa-quiet">{t('aa_ex_decision_sub')}</span>
      </div>
      <ExperimentChoiceList value={choice} onChange={setChoice} />
      <div className="aa-actions">
        <span className="aa-quiet">{t('aa_ex_decision_optional')}</span>
        <button type="button" className="aa-btn aa-btn-primary" disabled={busy} onClick={save}>{t('aa_ex_save')}</button>
      </div>
    </section>
  </>;
}
