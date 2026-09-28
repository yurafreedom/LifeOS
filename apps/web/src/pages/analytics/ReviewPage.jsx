import React from 'react';
import AADelta from '../../components/analytics/AADelta.jsx';
import AAFacts from '../../components/analytics/AAFacts.jsx';
import AAFactorTag from '../../components/analytics/AAFactorTag.jsx';
import AAHistoryList from '../../components/analytics/AAHistoryList.jsx';
import AAProvenance from '../../components/analytics/AAProvenance.jsx';
import AAQualityStrip from '../../components/analytics/AAQualityStrip.jsx';
import { useAAText } from '../../components/analytics/useAAText.js';
import { AnalyticsContext } from '../../context/AnalyticsContext.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import {
  REVIEW_CHOICES,
  REVIEW_STEPS,
  compareModel,
  coverageFromItems,
  itemsIn,
  openReviewHash,
  parseReviewHash,
  reviewReviseRequest,
  reviewSaveRequest,
  subjectFromKey,
} from '../../analytics/review';
import { formatValue } from '../../analytics/values';
import '../../analytics.css';

/*
 * E · Review / Debrief — semantic reflection, not a GTD weekly review.
 *
 * Five optional steps. Nothing is required, nothing is scored, nothing is
 * recommended, and no cause is inferred: factors carry the user's own epistemic
 * kind, and «Пока без решения» is a different answer from «Непонятно — данных
 * недостаточно». The evidence shown is exactly what the server froze; later
 * corrections are flagged beside it, and erased sources read «источник удалён».
 */

const CONCEPT_OF_ROLE = { expected: 'expectation', forecast: 'forecast', actual: 'actual', observation: 'observation', target: 'target' };
const CHOICE_KEYS = { keep: 'aa_rv_choice_keep', adjust: 'aa_rv_choice_adjust', later: 'aa_rv_choice_later', inconclusive: 'aa_rv_choice_inconclusive' };

function useNarrow() {
  const query = '(max-width: 700px)';
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

function formatInstant(value, t) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t('_intl_locale'), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
  });
}

function choiceLabel(choice, t) {
  return choice == null ? t('aa_rv_choice_none') : t(CHOICE_KEYS[choice]);
}

/** A flag shown beside a frozen value — never a substitute for it. */
export function flagText(item, t) {
  if (!item || item.redacted) return null;
  const now = item.current_value ? t('aa_rv_now', formatValue(item.current_value, t)) : null;
  const flags = item.source_flags ?? [];
  if (flags.includes('corrected')) return [t('aa_rv_flag_corrected'), now].filter(Boolean).join(' · ');
  if (flags.includes('withdrawn')) return t('aa_rv_flag_withdrawn');
  if (flags.includes('revised')) return [t('aa_rv_flag_revised'), now].filter(Boolean).join(' · ');
  return null;
}

function cellNote(item, t) {
  if (!item) return {};
  if (item.redacted) return { value: t('aa_pr_source_deleted'), empty: true, sub: null, estimate: false };
  const extra = flagText(item, t);
  return { ...(item.estimate ? { estimate: true } : {}), ...(extra ? { extra } : {}) };
}

/** The compare section, mapped onto the operands `AADelta` already understands. */
export function deltaProps(items, t) {
  const { reference, current, delta, target } = compareModel(items);
  const referenceConcept = reference?.role === 'forecast' ? 'forecast' : 'expectation';
  const coverage = coverageFromItems(items);
  const grounded = target != null && target.availability === 'present' && !target.redacted;
  const deltaValue = delta?.availability === 'present' && delta.value
    ? { state: 'known', type: delta.value.type, num: delta.value.num, unit_code: delta.value.unit_code,
      scale_min: delta.value.scale_min, scale_max: delta.value.scale_max }
    : {
      state: delta?.availability === 'not_applicable' ? 'not_applicable' : 'unknown',
      reason: delta?.availability === 'insufficient_data' ? 'insufficient_data' : 'operand_absent',
    };
  const summary = {
    actual: current?.value ? [{ id: 'current', value: current.value }] : [],
    expectations: referenceConcept === 'expectation' && reference?.value ? [{ id: 'reference', value: reference.value }] : [],
    forecasts: referenceConcept === 'forecast' && reference?.value ? [{ id: 'reference', value: reference.value }] : [],
    targets: target && !target.redacted
      ? [{ metric_key: target.metric_key, is_explicitly_absent: target.availability === 'explicitly_absent' }]
      : [],
  };
  const comparison = {
    metric_key: current?.metric_key ?? reference?.metric_key ?? null,
    current_concept: 'actual',
    current_id: 'current',
    reference_concept: referenceConcept,
    reference_id: 'reference',
    availability: current?.availability === 'insufficient_data' ? 'insufficient_data' : 'present',
    delta: deltaValue,
    desire: delta?.desire ?? 'neutral',
    grounding_id: grounded ? 'target' : null,
    grounding_kind: grounded ? 'target' : null,
    coverage: coverage && coverage !== 'redacted' ? coverage : null,
  };
  const notes = {
    reference: {
      ...(reference?.role === 'forecast' ? { label: t('aa_rv_label_forecast_latest') } : {}),
      ...cellNote(reference, t),
    },
    current: cellNote(current, t),
    delta: cellNote(delta, t),
  };
  return { summary, comparison, notes };
}

function provenanceLabel(item, t) {
  if (item.label_key === 'forecast_latest') return t('aa_rv_label_forecast_latest');
  if (item.role === 'delta') return t('aa_pr_delta');
  return t(`aa_pr_${CONCEPT_OF_ROLE[item.role] ?? 'actual'}`);
}

/** Step 1 and the reopened Review share one rendering of the frozen evidence. */
export function ReviewEvidence({ items, narrow = false }) {
  const t = useAAText();
  const { summary, comparison, notes } = deltaProps(items, t);
  const coverage = coverageFromItems(items);
  const sourced = itemsIn(items, 'compare').filter(item => item.provenance && !item.redacted);
  return <div className="aa-col">
    <AADelta summary={summary} comparison={comparison} narrow={narrow} notes={notes} />
    {sourced.length ? <div className="aa-review-sources">
      {sourced.map(item => <span className="aa-review-source" key={item.ordinal}>
        {provenanceLabel(item, t)}<AAProvenance provenance={item.provenance} narrow={narrow} />
      </span>)}
    </div> : null}
    {coverage === 'redacted'
      ? <p className="aa-flag aa-flag-erased">{t('aa_rv_quality_deleted')}</p>
      : coverage ? <AAQualityStrip coverage={coverage} /> : null}
  </div>;
}

function alongsideFacts(items, t) {
  return itemsIn(items, 'alongside').map(item => ({
    id: `item-${item.ordinal}`,
    concept: CONCEPT_OF_ROLE[item.role] ?? 'observation',
    value: item.value,
    value_availability: item.availability === 'explicitly_unknown' ? 'explicitly_unknown' : null,
    epistemic_kind: item.epistemic_kind,
    redacted: item.redacted,
    note: flagText(item, t),
  }));
}

function Alongside({ items, narrow }) {
  const t = useAAText();
  const facts = alongsideFacts(items, t);
  return <div className="aa-col">
    {facts.length ? <AAFacts facts={facts} narrow={narrow} /> : <div className="aa-none">{t('aa_rv_alongside_none')}</div>}
    <div className="aa-quiet">{t('aa_rv_worth_it')}</div>
  </div>;
}

function evidenceHistory(items, t) {
  return items
    .filter(item => item.section !== 'quality' && item.provenance && !item.redacted && item.provenance.recorded_at)
    .map(item => ({
      id: `item-${item.ordinal}`,
      concept: CONCEPT_OF_ROLE[item.role] ?? 'actual',
      label: provenanceLabel(item, t),
      value: item.value,
      is_explicitly_absent: item.availability === 'explicitly_absent',
      value_availability: item.availability === 'explicitly_unknown' ? 'explicitly_unknown' : null,
      provenance: { ...item.provenance, recorded_at: formatInstant(item.provenance.recorded_at, t) },
    }));
}

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

function eyebrow(subjectKey, t, projects) {
  const subject = subjectFromKey(subjectKey);
  if (subject.domain === 'finance') return t('aa_rv_eyebrow_finance', subject.id);
  const title = projects?.find(project => String(project.id) === subject.id)?.title;
  return t('aa_rv_eyebrow_project', title ?? '');
}

function exitHash(subjectKey) {
  return subjectFromKey(subjectKey).domain === 'finance' ? '#/analytics' : '#/projects';
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

/** A saved Review: frozen evidence with flags, everything the user wrote, and «дополнить». */
export function SavedReview({ review, projects, onRevise, narrow = false }) {
  const t = useAAText();
  const [note, setNote] = React.useState('');
  const [added, setAdded] = React.useState([]);
  const [retracted, setRetracted] = React.useState([]);
  const [decision, setDecision] = React.useState(undefined);
  const [message, setMessage] = React.useState(null);
  const noteId = React.useId();
  const current = review.factors.filter(factor => factor.retracted_in_revision == null && !retracted.includes(factor.id));
  const withdrawn = review.factors.filter(factor => factor.retracted_in_revision != null);
  const history = review.decisions.filter(row => row.superseded_in_revision != null);

  async function submit(event) {
    event.preventDefault();
    const request = reviewReviseRequest(review.id, { note, addFactors: added, retractFactorIds: retracted, decision });
    if (!request) { setMessage(t('aa_rv_revise_nothing')); return; }
    try {
      await onRevise(request);
      setNote(''); setAdded([]); setRetracted([]); setDecision(undefined);
      setMessage(t('aa_rv_revise_queued'));
    } catch {
      setMessage(t('aa_rv_save_failed'));
    }
  }

  return <div className="aa-col">
    <div className="aa-review-head">
      <div className="aa-eyebrow">{eyebrow(review.subject_key, t, projects)}</div>
      <span className="aa-quiet">
        {t('aa_rv_created', formatInstant(review.created_at, t))}
        {review.revised_at ? ` · ${t('aa_rv_revised', formatInstant(review.revised_at, t))}` : ''}
      </span>
    </div>
    <section className="aa-review-card" aria-labelledby="aa-rv-evidence">
      <h2 className="aa-q" id="aa-rv-evidence">{t('aa_rv_evidence')}</h2>
      <div className="aa-help">{t('aa_rv_frozen_note')}</div>
      <ReviewEvidence items={review.items} narrow={narrow} />
      {itemsIn(review.items, 'alongside').length ? <AAFacts facts={alongsideFacts(review.items, t)} narrow={narrow} /> : null}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-notes">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-notes">{t('aa_rv_notes')}</h3>
      {review.revisions.some(row => row.note_text)
        ? review.revisions.filter(row => row.note_text).map(row => <p key={row.revision} className="aa-factor-text">
          {row.revision > 1 ? <span className="aa-quiet">{t('aa_rv_revision_n', row.revision - 1)} · </span> : null}{row.note_text}
        </p>)
        : <p className="aa-quiet">{t('aa_rv_notes_none')}</p>}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-factors">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-factors">{t('aa_rv_factors')}</h3>
      {current.length || withdrawn.length ? null : <p className="aa-quiet">{t('aa_rv_factors_none')}</p>}
      {current.map(factor => <div className="aa-factor" key={factor.id}>
        <span className="aa-factor-text">{factor.text}</span>
        <AAFactorTag kind={factor.epistemic_kind}
          onChange={kind => {
            setRetracted(ids => [...ids, factor.id]);
            setAdded(list => [...list, { key: `re-${factor.id}`, text: factor.text, epistemic_kind: kind, replaces_id: factor.id }]);
          }}
          onRemove={() => setRetracted(ids => [...ids, factor.id])} />
      </div>)}
      {withdrawn.map(factor => <div className="aa-factor is-retracted" key={factor.id}>
        <span className="aa-factor-text">{factor.text} <span className="aa-quiet">· {t('aa_rv_retracted', factor.retracted_in_revision - 1)}</span></span>
        <AAFactorTag kind={factor.epistemic_kind} readOnly />
      </div>)}
    </section>
    <section className="aa-review-card" aria-labelledby="aa-rv-decision">
      <h3 className="aa-eyebrow aa-eyebrow-strong" id="aa-rv-decision">{t('aa_rv_decision')}</h3>
      <p className="aa-factor-text">{review.decision ? choiceLabel(review.decision.choice, t) : t('aa_rv_decision_skipped')}</p>
      {history.length ? <p className="aa-quiet">{t('aa_rv_decision_history', history.map(row => choiceLabel(row.choice, t)).join(' → '))}</p> : null}
    </section>
    <form className="aa-review-card" onSubmit={submit} aria-labelledby="aa-rv-revise">
      <h3 className="aa-q" id="aa-rv-revise">{t('aa_rv_revise_title')}</h3>
      <label className="aa-quiet" htmlFor={noteId}>{t('aa_rv_revise_note')}</label>
      <textarea id={noteId} className="aa-textarea" value={note} maxLength={4000} onChange={event => setNote(event.target.value)} />
      <FactorEditor factors={added.filter(factor => !factor.replaces_id)}
        onChange={list => setAdded([...added.filter(factor => factor.replaces_id), ...list])} idPrefix="add" />
      <ChoiceList value={decision} onChange={setDecision} allowUnchanged name="revise" />
      {message ? <p className="aa-quiet" role="status">{message}</p> : null}
      <div className="aa-actions"><span />
        <button type="submit" className="aa-btn aa-btn-primary">{t('aa_rv_revise_save')}</button>
      </div>
    </form>
  </div>;
}

function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

export default function ReviewPage() {
  const t = useAAText();
  const analytics = React.useContext(AnalyticsContext);
  const projects = React.useContext(LifeDataContext)?.state?.projects;
  const narrow = useNarrow();
  const [route, setRoute] = React.useState(() => parseReviewHash(readHash()));
  const [data, setData] = React.useState({ loading: true, error: null, context: null, review: null, earlier: [] });
  const ready = analytics?.ready;

  React.useEffect(() => {
    const onHash = () => setRoute(parseReviewHash(readHash()));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = React.useCallback(async signal => {
    if (!route || !ready) return;
    setData(previous => ({ ...previous, loading: true, error: null }));
    try {
      if (route.mode === 'new') {
        const [context, earlier] = await Promise.all([
          analytics.readReviewContext({ subject: route.subject, from: route.from, to: route.to }, signal),
          analytics.listReviews(route.subject, signal).then(list => list.reviews).catch(() => []),
        ]);
        setData({ loading: false, error: null, context, review: null, earlier });
      } else {
        const review = await analytics.readReview(route.id, signal);
        setData({ loading: false, error: null, context: null, review, earlier: [] });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setData({ loading: false, error, context: null, review: null, earlier: [] });
    }
  }, [route, ready]);

  React.useEffect(() => {
    const controller = new window.AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function revise(request) {
    await analytics.enqueueReview(request);
    await analytics.flush?.();
    await load();
  }

  const subjectKey = route?.mode === 'new' ? route.subject : data.review?.subject_key;
  let body;
  if (!route) body = <div className="aa-none">{t('aa_rv_bad_link')}</div>;
  else if (data.error) body = <div className="aa-none" role="alert">{t('aa_rv_unavailable', data.error.message)}</div>;
  else if (data.loading || !analytics) body = <div className="aa-quiet">{t('aa_rv_loading')}</div>;
  else if (route.mode === 'new') {
    body = <ReviewFlow context={data.context} projects={projects} narrow={narrow} earlier={data.earlier}
      onSave={request => analytics.enqueueReview(request)} />;
  } else {
    body = <SavedReview key={`${data.review.id}-${data.review.current_revision}`} review={data.review}
      projects={projects} narrow={narrow} onRevise={revise} />;
  }
  return <section className={`aa-review${narrow ? ' aa-narrow' : ''}`}>
    <div><a className="aa-link" href={subjectKey ? exitHash(subjectKey) : '#/home'}>{t('aa_rv_exit')}</a></div>
    {body}
  </section>;
}
