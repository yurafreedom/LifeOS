/* System Review · relations and proposals (OD-7.1).

   A relation is an association or a marked hypothesis — never a cause and
   never proof. A proposal is the system's question, not its conclusion: it
   shows why it was suggested and waits for the user's answer. An answer that
   is still in the queue is shown as pending and is not counted as answered. */

import React from 'react';
import {
  RELATION_STATUSES,
  RELATION_TYPES,
  isHypothesis,
  relationDeleteRequest,
  relationFeedbackRequest,
} from '../../../analytics/systemReviewFacts';
import AAImportance from '../../../components/analytics/AAImportance.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { codeText, epistemicText, instantText, periodTitle, refText, relationTypeText } from './format.js';
import { Empty, Section } from './Sections.jsx';

export function KindMarker({ kind }) {
  const t = useAAText();
  return <span className={`aa-tag aa-sr-kind${kind === 'hypothesis' ? ' is-hypothesis' : ''}`}
    data-kind={kind === 'hypothesis' ? 'maybe' : 'observed'}>{epistemicText(kind, t)}</span>;
}

function Pair({ from, to, type, names }) {
  const t = useAAText();
  const arrow = ['related', 'temporally_associated', 'co_occurs_with', 'conflicts_with'].includes(type) ? '↔' : '→';
  return <div className="aa-sr-rel-pair">
    <span className={`aa-sr-rel-end${from.redacted ? ' is-redacted' : ''}`}>{refText(from.key, names, t)}</span>
    <span className="aa-sr-rel-type"><span aria-hidden="true">{arrow}</span> {relationTypeText(type, t)}</span>
    <span className={`aa-sr-rel-end${to.redacted ? ' is-redacted' : ''}`}>{refText(to.key, names, t)}</span>
  </div>;
}

function Conditions({ conditions }) {
  const t = useAAText();
  return <ul className="aa-sr-conditions">
    {conditions.map((condition, index) => <li key={index}>
      {t(`aa_sr_cond_${condition.field}`, typeof condition.value === 'string'
        ? codeText('cond_value', condition.value, t) : String(condition.value))}
    </li>)}
  </ul>;
}

export function ProposalCard({ candidate, names, pending, actions, evaluatedAt }) {
  const t = useAAText();
  const [note, setNote] = React.useState('');
  const [noteOpen, setNoteOpen] = React.useState(false);
  const queued = pending.responses[candidate.proposal_key];
  const answer = response => actions.respond(candidate, response, note, evaluatedAt);
  const history = candidate.history ?? {};
  return <article className="aa-sr-proposal" data-kind={candidate.epistemic_kind}
    aria-label={t('aa_sr_possible_relation')}>
    <div className="aa-sr-proposal-top">
      <span className="aa-eyebrow">{t('aa_sr_possible_relation')}</span>
      <KindMarker kind={candidate.epistemic_kind} />
      <span className="aa-quiet">{periodTitle(candidate.period, t)}</span>
    </div>
    <Pair from={candidate.from} to={candidate.to} type={candidate.relation_type} names={names} />
    <div className="aa-sr-why">
      <span className="aa-quiet">{t('aa_sr_why_suggested')}</span>
      <Conditions conditions={candidate.conditions} />
      <span className="aa-quiet">{t('aa_sr_rule_version', t(`aa_sr_family_${candidate.family}`), candidate.rule_version)}</span>
      {history.approved + history.rejected + history.unsure > 0
        ? <span className="aa-quiet">{t('aa_sr_family_history', history.approved, history.rejected, history.unsure)}</span>
        : null}
    </div>
    {queued
      ? <p className="aa-quiet aa-sr-pending" role="status">{t('aa_sr_answer_pending', t(`aa_sr_answer_${queued}`))}</p>
      : <>
        {noteOpen ? <textarea className="aa-textarea" maxLength={1000} value={note}
          aria-label={t('aa_sr_note_label')} placeholder={t('aa_sr_note_placeholder')}
          onChange={event => setNote(event.target.value)} /> : null}
        <div className="aa-actions">
          <button type="button" className="aa-link aa-link-quiet" onClick={() => setNoteOpen(v => !v)}>
            {noteOpen ? t('aa_sr_note_hide') : t('aa_sr_note_add')}
          </button>
          <span className="aa-actions-right">
            <button type="button" className="aa-btn aa-btn-primary" disabled={actions.busy}
              onClick={() => answer('approved')}>{t('aa_sr_approve')}</button>
            <button type="button" className="aa-btn aa-btn-ghost" disabled={actions.busy}
              onClick={() => answer('rejected')}>{t('aa_sr_reject')}</button>
            <button type="button" className="aa-btn aa-btn-ghost" disabled={actions.busy}
              onClick={() => answer('unsure')}>{t('aa_sr_unsure')}</button>
          </span>
        </div>
      </>}
  </article>;
}

export function ProposalsSection({ review, names, pending, actions }) {
  const t = useAAText();
  const block = review.sections.requires_confirmation;
  return <Section id="sr-requires" title={t('aa_sr_requires', block.count)} note={t('aa_sr_requires_note')}>
    {block.items.length
      ? <div className="aa-col">{block.items.map(candidate => <ProposalCard key={candidate.proposal_key}
        candidate={candidate} names={names} pending={pending} actions={actions}
        evaluatedAt={review.evaluated_at} />)}</div>
      : <p className="aa-none">{t(review.period_kind === 'year' ? 'aa_sr_requires_year' : 'aa_sr_requires_empty')}</p>}
    <p className="aa-quiet">{t('aa_sr_ranking_note')}</p>
  </Section>;
}

function RelationRow({ relation, names, importance, pending, actions }) {
  const t = useAAText();
  const [editing, setEditing] = React.useState(false);
  const [note, setNote] = React.useState(relation.note ?? '');
  const deleting = pending.deletes.has(relation.id);
  const queuedAnswer = pending.feedback[relation.id];
  const own = relation.source === 'user';
  const label = `${refText(relation.from.key, names, t)} — ${refText(relation.to.key, names, t)}`;
  return <li className="aa-sr-rel" data-status={relation.status} data-kind={relation.epistemic_kind}>
    <div className="aa-sr-rel-head">
      <KindMarker kind={relation.epistemic_kind} />
      <span className="aa-tag" data-kind="mine">{t(`aa_sr_status_rel_${relation.status}`)}</span>
      <span className="aa-quiet">{t(`aa_sr_source_${relation.source}`)}</span>
      {relation.evidence_changed_since_response
        ? <span className="aa-tag" data-kind="maybe">{t(relation.revisit_eligible ? 'aa_sr_revisit' : 'aa_sr_evidence_changed')}</span>
        : null}
      {relation.endpoint_redacted ? <span className="aa-tag" data-kind="unknown">{t('aa_sr_source_deleted')}</span> : null}
    </div>
    <Pair from={relation.from} to={relation.to} type={relation.relation_type} names={names} />
    {relation.note && !editing ? <p className="aa-sr-note">«{relation.note}»</p> : null}
    {editing ? <div className="aa-field">
      <textarea className="aa-textarea" maxLength={1000} value={note} aria-label={t('aa_sr_note_label')}
        onChange={event => setNote(event.target.value)} />
      <div className="aa-actions-right">
        <button type="button" className="aa-btn aa-btn-ghost" onClick={() => setEditing(false)}>{t('aa_sr_cancel')}</button>
        <button type="button" className="aa-btn aa-btn-primary" disabled={actions.busy} onClick={() => {
          actions.enqueue(relationFeedbackRequest(relation.id, own ? 'approved' : relation.status === 'proposed' ? 'unsure' : relation.status, note));
          setEditing(false);
        }}>{t('aa_sr_save_note')}</button>
      </div>
    </div> : null}
    {deleting ? <p className="aa-quiet" role="status">{t('aa_sr_delete_pending')}</p> : null}
    {queuedAnswer ? <p className="aa-quiet" role="status">{t('aa_sr_answer_pending', t(`aa_sr_answer_${queuedAnswer}`))}</p> : null}
    <div className="aa-change-foot">
      <AAImportance value={importance?.importance ?? null} pending={pending.importance[`relation|${relation.id}`] ?? null}
        label={label} onChange={value => actions.setImportance(`relation|${relation.id}`, value)} />
      {!editing && !deleting ? <button type="button" className="aa-link aa-link-quiet"
        onClick={() => setEditing(true)}>{t('aa_sr_edit_note')}</button> : null}
      {!own && !deleting ? ['approved', 'unsure', 'rejected'].filter(s => s !== relation.status).map(status =>
        <button key={status} type="button" className="aa-link aa-link-quiet" disabled={actions.busy}
          onClick={() => actions.enqueue(relationFeedbackRequest(relation.id, status, relation.note))}>
          {t(`aa_sr_change_to_${status}`)}
        </button>) : null}
      {own && !deleting ? <button type="button" className="aa-link aa-link-quiet" disabled={actions.busy}
        onClick={() => actions.enqueue(relationDeleteRequest(relation.id))}>{t('aa_sr_remove_link')}</button> : null}
    </div>
    {relation.history?.length ? <details className="aa-sr-history">
      <summary className="aa-quiet">{t('aa_sr_answer_history', relation.history.length)}</summary>
      <ul>{relation.history.map((entry, index) => <li key={index} className="aa-quiet">
        {instantText(entry.responded_at, t)} · {t(`aa_sr_answer_${entry.response}`)}{entry.note ? ` · «${entry.note}»` : ''}
      </li>)}</ul>
    </details> : null}
  </li>;
}

const ALL = '';

export function filterRelations(relations, filters, importanceMap) {
  return relations.filter(relation => {
    if (filters.type && relation.relation_type !== filters.type) return false;
    if (filters.status && relation.status !== filters.status) return false;
    if (filters.source && relation.source !== filters.source) return false;
    if (filters.domain && relation.from.domain !== filters.domain && relation.to.domain !== filters.domain) return false;
    if (filters.importance) {
      const value = importanceMap[`relation|${relation.id}`]?.importance ?? 'none';
      if (filters.importance === 'undecided' ? value !== 'none' : value !== filters.importance) return false;
    }
    return true;
  });
}

function Filter({ label, value, options, onChange }) {
  return <label className="aa-sr-filter">
    <span className="aa-quiet">{label}</span>
    <select className="aa-input" value={value} onChange={event => onChange(event.target.value)}>
      {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
    </select>
  </label>;
}

export function RelationsSection({ review, names, pending, actions }) {
  const t = useAAText();
  const [filters, setFilters] = React.useState({ type: ALL, status: ALL, source: ALL, domain: ALL, importance: ALL });
  const relations = review.sections.relations.items.filter(relation => !pending.deletes.has(relation.id));
  const shown = filterRelations(relations, filters, review.importance);
  const set = name => value => setFilters(previous => ({ ...previous, [name]: value }));
  const all = [ALL, t('aa_sr_filter_all')];
  return <Section id="sr-relations" title={t('aa_sr_relations')} note={t('aa_sr_relations_note')}>
    <div className="aa-sr-filters" role="group" aria-label={t('aa_sr_filters')}>
      <Filter label={t('aa_sr_filter_type')} value={filters.type} onChange={set('type')}
        options={[all, ...RELATION_TYPES.map(type => [type, `${relationTypeText(type, t)}${isHypothesis(type) ? ` · ${t('aa_sr_hypothesis')}` : ''}`])]} />
      <Filter label={t('aa_sr_filter_status')} value={filters.status} onChange={set('status')}
        options={[all, ...RELATION_STATUSES.map(status => [status, t(`aa_sr_status_rel_${status}`)])]} />
      <Filter label={t('aa_sr_filter_source')} value={filters.source} onChange={set('source')}
        options={[all, ['user', t('aa_sr_source_user')], ['rule', t('aa_sr_source_rule')]]} />
      <Filter label={t('aa_sr_filter_domain')} value={filters.domain} onChange={set('domain')}
        options={[all, ...['finance', 'project', 'experiment', 'observation'].map(domain => [domain, t(`aa_sr_domain_${domain}`)])]} />
      <Filter label={t('aa_sr_filter_importance')} value={filters.importance} onChange={set('importance')}
        options={[all, ['matters', t('aa_sr_imp_matters')], ['ok', t('aa_sr_imp_ok')], ['ignore', t('aa_sr_imp_ignore')], ['undecided', t('aa_sr_imp_none')]]} />
    </div>
    {pending.links.length ? <p className="aa-quiet" role="status">{t('aa_sr_links_pending', pending.links.length)}</p> : null}
    {shown.length
      ? <ul className="aa-sr-rels">{shown.map(relation => <RelationRow key={relation.id} relation={relation}
        names={names} importance={review.importance[`relation|${relation.id}`]} pending={pending} actions={actions} />)}</ul>
      : relations.length ? <p className="aa-none">{t('aa_sr_filter_empty')}</p> : <Empty />}
    <p className="aa-warn-note">{t('aa_sr_relation_not_cause')}</p>
  </Section>;
}
