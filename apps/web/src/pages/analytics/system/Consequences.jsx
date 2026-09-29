/* System Review · consequences — projections under explicit assumptions.

   Every impact shows its result with the assumptions directly beneath it,
   the inputs it used (and where they came from), the calculation, and what is
   missing. A missing input reads «нужен ввод», never a number. No purchase is
   judged; attention notes list the exact conditions that raised them. */

import React from 'react';
import { financeContextDeleteRequest } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import {
  ExpenseContextForm,
  EssentialsForm,
  ObligationForm,
  ReserveForm,
} from './ContextForms.jsx';
import { codeText, contextSummary, dateText, impactLines, refText, valueText } from './format.js';
import { Section } from './Sections.jsx';
import { SelfCheck } from './SelfCheck.jsx';

function Codes({ prefix, codes }) {
  const t = useAAText();
  if (!codes?.length) return null;
  return <ul className="aa-sr-codes">{codes.map(code => <li key={code}>{codeText(prefix, code, t)}</li>)}</ul>;
}

function inputValue(value, t) {
  if (value && typeof value === 'object' && 'type' in value) return valueText(value, t);
  return String(value ?? '—');
}

export function ImpactCard({ impact }) {
  const t = useAAText();
  if (impact.redacted) return <div className="aa-sr-impact is-redacted"><span className="aa-flag-erased">{t('aa_sr_source_deleted')}</span></div>;
  const lines = impactLines(impact, t);
  return <div className="aa-sr-impact" data-state={impact.state}>
    <div className="aa-sr-impact-head">
      <span className="aa-sr-text"><b>{t(`aa_sr_impact_${impact.kind}`)}</b></span>
      <span className="aa-tag" data-kind={impact.state === 'computed' ? 'observed' : 'unknown'}>
        {t(`aa_sr_state_${impact.state}`)}
      </span>
    </div>
    {impact.state === 'computed' && lines.length ? <dl className="aa-sr-proj">
      {lines.map(([label, value]) => <div className="aa-mini" key={label}><dt>{label}</dt><dd className="aa-mini-v">{value}</dd></div>)}
    </dl> : null}
    {impact.assumptions.length ? <div className="aa-sr-assumptions">
      <span className="aa-quiet">{t('aa_sr_assumptions')}</span>
      <Codes prefix="code" codes={impact.assumptions} />
    </div> : null}
    {impact.missing_inputs.length ? <div className="aa-sr-missing">
      <span className="aa-quiet">{t('aa_sr_needs_input')}</span>
      <Codes prefix="code" codes={impact.missing_inputs} />
    </div> : null}
    {impact.limitations.length ? <div className="aa-sr-limitations">
      <span className="aa-quiet">{t('aa_sr_limitations')}</span>
      <Codes prefix="code" codes={impact.limitations} />
    </div> : null}
    {impact.inputs.length || impact.calculation ? <details className="aa-sr-calc">
      <summary className="aa-quiet">{t('aa_sr_how_calculated')}</summary>
      {impact.inputs.length ? <ul className="aa-sr-codes">{impact.inputs.map(input => <li key={input.name}>
        {codeText('code', input.name, t)}: <b>{inputValue(input.value, t)}</b> · {t(`aa_sr_input_${input.source}`)}
      </li>)}</ul> : null}
      {impact.calculation ? <p className="aa-quiet aa-sr-formula">{impact.calculation.formula}</p> : null}
      {impact.horizon ? <p className="aa-quiet">{t('aa_sr_horizon', codeText('code', impact.horizon, t))}</p> : null}
    </details> : null}
  </div>;
}

function Attention({ flags }) {
  const t = useAAText();
  if (!flags?.length) return null;
  return <div className="aa-sr-attention">
    <span className="aa-quiet">{t('aa_sr_attention')}</span>
    <ul className="aa-sr-conditions">
      {flags.map(flag => <li key={flag.flag}>
        {t(`aa_sr_flag_${flag.flag}`)}
        <span className="aa-quiet"> — {flag.conditions.map(condition =>
          `${codeText('code', condition.field, t)}: ${typeof condition.value === 'string' ? codeText('cond_value', condition.value, t) : condition.value}`).join('; ')}</span>
      </li>)}
    </ul>
  </div>;
}

function ExpenseCard({ analysis, names, obligations, actions, editing, setEditing }) {
  const t = useAAText();
  const [confirming, setConfirming] = React.useState(false);
  if (analysis.redacted) return <article className="aa-sr-expense is-redacted"><span className="aa-flag-erased">{t('aa_sr_source_deleted')}</span></article>;
  const entityId = analysis.context_ref.split('|')[1];
  const context = analysis.context;
  const words = ['purpose', 'motive', 'emotional_context'].filter(field => context[field]);
  const open = editing === analysis.ref;
  return <article className="aa-sr-expense" aria-label={refText(analysis.ref, names, t)}>
    <div className="aa-sr-expense-head">
      <span className="aa-sr-text"><b>{refText(analysis.ref, names, t)}</b></span>
      <span className="aa-quiet">{dateText(analysis.expense.date, t)}</span>
    </div>
    <p className="aa-quiet">{contextSummary(context, t)}</p>
    {words.length ? <dl className="aa-sr-words">{words.map(field => <div key={field}>
      <dt className="aa-quiet">{t(`aa_sr_f_${field === 'emotional_context' ? 'emotional' : field}`)}</dt>
      <dd>«{context[field]}»</dd>
    </div>)}</dl> : null}
    {context.worth_it ? <p className="aa-quiet">{t('aa_sr_f_worth_it')}: {t(`aa_sr_worth_${context.worth_it}`)}</p> : null}
    <Attention flags={analysis.attention} />
    <div className="aa-sr-impacts">{analysis.impacts.map(impact => <ImpactCard key={impact.kind} impact={impact} />)}</div>
    {analysis.missing_inputs.length ? <p className="aa-quiet">{t('aa_sr_missing_hint')}</p> : null}
    {open ? <ExpenseContextForm transactionId={analysis.transaction_id} entityId={entityId} initial={context}
      obligations={obligations} busy={actions.busy}
      onCancel={() => setEditing(null)}
      onSave={request => { actions.enqueue(request); setEditing(null); }} /> : null}
    <div className="aa-change-foot">
      {!open ? <button type="button" className="aa-link" onClick={() => setEditing(analysis.ref)}>{t('aa_sr_edit_context')}</button> : null}
      {confirming ? <span className="aa-sr-confirm" role="alert">
        <span className="aa-quiet">{t('aa_sr_delete_context_q')}</span>
        <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setConfirming(false)}>{t('aa_sr_cancel')}</button>
        <button type="button" className="aa-btn aa-btn-primary" onClick={() => {
          setConfirming(false);
          actions.enqueue(financeContextDeleteRequest(entityId));
        }}>{t('aa_sr_delete_confirm')}</button>
      </span> : <button type="button" className="aa-link aa-link-quiet" onClick={() => setConfirming(true)}>{t('aa_sr_delete_context')}</button>}
    </div>
  </article>;
}

function PositionEntry({ entry, onEdit, onDelete }) {
  const t = useAAText();
  const money = (field) => entry[field] != null ? valueText({ type: 'money', unit_code: entry.currency, num: String(entry[field]) }, t) : null;
  const parts = entry.group === 'obligations'
    ? [money('outstanding'), entry.monthly_payment ? t('aa_sr_pos_payment', money('monthly_payment')) : t('aa_sr_pos_no_payment'),
      entry.annual_rate_percent != null ? t('aa_sr_pos_rate', entry.annual_rate_percent) : t('aa_sr_pos_no_rate'),
      entry.planned_payoff_date ? t('aa_sr_pos_planned', dateText(entry.planned_payoff_date, t)) : null]
    : entry.group === 'reserves'
      ? [money('amount'), entry.threshold != null ? t('aa_sr_pos_threshold', money('threshold')) : t('aa_sr_pos_no_threshold')]
      : [t('aa_sr_pos_monthly', money('monthly_amount'))];
  return <li className="aa-sr-pos">
    <span className="aa-sr-text"><b>{entry.label || t(`aa_sr_pos_${entry.group}`)}</b> · {parts.filter(Boolean).join(' · ')}</span>
    <span className="aa-quiet">{t('aa_sr_pos_as_of', dateText(entry.as_of, t))}</span>
    <span className="aa-actions-right">
      <button type="button" className="aa-link aa-link-quiet" onClick={onEdit}>{t('aa_sr_edit')}</button>
      <button type="button" className="aa-link aa-link-quiet" onClick={onDelete}>{t('aa_sr_delete')}</button>
    </span>
  </li>;
}

function PositionPanel({ position, actions }) {
  const t = useAAText();
  const [form, setForm] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const groups = [
    ['obligations', position?.obligations ?? [], ObligationForm],
    ['reserves', position?.reserves ?? [], ReserveForm],
    ['essentials', position?.essentials ?? [], EssentialsForm],
  ];
  const save = request => { actions.enqueue(request); setForm(null); };
  return <div className="aa-sr-position">
    <div className="aa-section-head">
      <h4 className="aa-sr-form-title">{t('aa_sr_position')}</h4>
      <span className="aa-quiet">{t('aa_sr_position_note')}</span>
    </div>
    {groups.map(([group, entries, Form]) => <div key={group} className="aa-col">
      <span className="aa-eyebrow">{t(`aa_sr_pos_${group}`)}</span>
      {entries.length ? <ul className="aa-sr-pos-list">{entries.map(entry => <PositionEntry key={entry.entity_id}
        entry={{ ...entry, group }}
        onEdit={() => setForm({ group, entry })}
        onDelete={() => setConfirm(entry.entity_id)} />)}</ul>
        : <p className="aa-quiet">{t('aa_sr_needs_input_short')}</p>}
      {form?.group === group ? <Form entityId={form.entry?.entity_id} initial={form.entry} busy={actions.busy}
        onSave={save} onCancel={() => setForm(null)} /> : <button type="button" className="aa-link"
        onClick={() => setForm({ group, entry: null })}>{t(`aa_sr_add_${group}`)}</button>}
    </div>)}
    <p className="aa-quiet">{t('aa_sr_income_not_modeled')}</p>
    {confirm ? <div className="aa-sr-confirm" role="alert">
      <span className="aa-quiet">{t('aa_sr_delete_context_q')}</span>
      <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setConfirm(null)}>{t('aa_sr_cancel')}</button>
      <button type="button" className="aa-btn aa-btn-primary" onClick={() => {
        actions.enqueue(financeContextDeleteRequest(confirm));
        setConfirm(null);
      }}>{t('aa_sr_delete_confirm')}</button>
    </div> : null}
  </div>;
}

function AnalysePicker({ period, life, analysed, obligations, actions }) {
  const t = useAAText();
  const [picked, setPicked] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const transactions = (life?.transactions ?? [])
    .filter(tx => String(tx.date ?? '').startsWith(period) && !analysed.has(String(tx.id)));
  if (!transactions.length) return <p className="aa-quiet">{t('aa_sr_analyse_none')}</p>;
  return <div className="aa-sr-analyse">
    {!open ? <div className="aa-exp-form-row">
      <label className="aa-field">
        <span className="aa-quiet">{t('aa_sr_analyse_pick')}</span>
        <select className="aa-input" value={picked} onChange={event => setPicked(event.target.value)}>
          <option value="">{t('aa_sr_not_specified')}</option>
          {transactions.map(tx => <option key={tx.id} value={String(tx.id)}>
            {tx.description || tx.category_id} · ₴{tx.amount} · {tx.date}
          </option>)}
        </select>
      </label>
      <button type="button" className="aa-btn aa-btn-ghost" disabled={!picked} onClick={() => setOpen(true)}>
        {t('aa_sr_analyse_start')}
      </button>
    </div> : <ExpenseContextForm transactionId={picked} obligations={obligations} busy={actions.busy}
      onCancel={() => setOpen(false)} onSave={request => { actions.enqueue(request); setOpen(false); setPicked(''); }} />}
    <p className="aa-quiet">{t('aa_sr_analyse_note')}</p>
  </div>;
}

export function ConsequencesSection({ review, names, life, pending, actions }) {
  const t = useAAText();
  const [editing, setEditing] = React.useState(null);
  const block = review.sections.consequences;
  const obligations = block.position?.obligations ?? [];
  const analysed = new Set(block.expenses.map(analysis => analysis.transaction_id));
  if (review.period_kind === 'year') {
    return <Section id="sr-consequences" title={t('aa_sr_consequences')} note={t('aa_sr_consequences_note')}>
      {block.funding_summary?.length ? <div className="aa-sr-group">{block.funding_summary.map((row, index) =>
        <div className="aa-sr-item" key={index}>
          <span className="aa-sr-text">{codeText('plan', row.plannedness, t)} · {codeText('fund', row.funding_source, t)}</span>
          <span className="aa-mini-v">{t('aa_sr_count_total', row.count, valueText(row.total, t))}</span>
        </div>)}</div> : <p className="aa-none">{t('aa_sr_year_consequences_empty')}</p>}
    </Section>;
  }
  return <Section id="sr-consequences" title={t('aa_sr_consequences')} note={t('aa_sr_consequences_note')}>
    {pending.contexts.length || pending.contextDeletes.size
      ? <p className="aa-quiet" role="status">{t('aa_sr_context_pending', pending.contexts.length + pending.contextDeletes.size)}</p> : null}
    <PositionPanel position={block.position} actions={actions} />
    {block.expenses.length ? <div className="aa-col">{block.expenses.map(analysis => <ExpenseCard key={analysis.ref}
      analysis={analysis} names={names} obligations={obligations} actions={actions}
      editing={editing} setEditing={setEditing} />)}</div>
      : <p className="aa-none">{t('aa_sr_consequences_empty')}</p>}
    <AnalysePicker period={review.period} life={life} analysed={analysed} obligations={obligations} actions={actions} />
    <SelfCheck period={review.period} block={block.self_check} busy={actions.busy}
      onSave={request => actions.enqueue(request)} />
    <p className="aa-warn-note">{t('aa_sr_projection_note')}</p>
  </Section>;
}
