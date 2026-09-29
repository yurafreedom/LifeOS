/* System Review · one saved revision, exactly as stored. A later correction
   changes the live review, never this; an erased source reads «источник
   удалён» in place. The user's own words are shown first. */

import React from 'react';
import { revisionHash, systemReviewHash } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { ImpactCard } from './Consequences.jsx';
import { buildLookup, instantText, refText } from './format.js';
import { KindMarker } from './Relations.jsx';
import { ChangeCard, Empty, Section } from './Sections.jsx';
import { ExportButtons } from './SavedReview.jsx';

function pseudoReview(frozen) {
  const sections = frozen?.sections ?? {};
  const consequences = sections.consequences ?? {};
  return {
    sections: {
      changed: { items: (sections.changed ?? []).filter(item => !item.redacted) },
      consequences: {
        expenses: (consequences.expenses ?? []).filter(item => !item.redacted),
        position: { obligations: (consequences.position ?? []).filter(entry => entry.group === 'obligations') },
      },
    },
    linkable: [],
  };
}

export function RevisionView({ revision, error, period, number, life, narrow }) {
  const t = useAAText();
  const names = React.useMemo(() => buildLookup(pseudoReview(revision?.frozen), life), [revision, life]);
  if (!revision) {
    return <section className="card panel" aria-busy={!error}>
      {error ? <p className="aa-none" role="alert">{t(error.status === 404 ? 'aa_sr_revision_missing' : 'aa_sr_unavailable')}</p>
        : <p className="aa-note">{t('aa_sr_loading')}</p>}
      <a className="aa-link" href={systemReviewHash(period)}>{t('aa_sr_back_to_review')}</a>
    </section>;
  }
  const sections = revision.frozen.sections ?? {};
  const consequences = sections.consequences ?? {};
  return <div className={`aa-sr${narrow ? ' aa-narrow' : ''}`}>
    <div className="aa-actions aa-sr-toolbar">
      <a className="aa-link" href={systemReviewHash(period)}>‹ {t('aa_sr_back_to_review')}</a>
      <span className="aa-actions-right">
        {number > 1 ? <a className="aa-link" href={revisionHash(period, number - 1)}>{t('aa_sr_prev_revision')}</a> : null}
      </span>
    </div>
    <section className="card panel aa-section">
      <div className="aa-sr-meta">
        <span className="aa-tag" data-kind={revision.status === 'finalized' ? 'observed' : 'unknown'}>{t(`aa_sr_rev_${revision.status}`)}</span>
        <span className="aa-quiet">{t('aa_sr_saved_at', instantText(revision.created_at, t))}</span>
        <span className="aa-quiet">{t('aa_sr_evidence_as_of', instantText(revision.context_as_of, t))}</span>
        {revision.redacted_at ? <span className="aa-tag" data-kind="unknown">{t('aa_sr_has_redactions')}</span> : null}
      </div>
      {revision.live_sources_changed ? <p className="aa-warn-note">{t('aa_sr_live_changed')}</p> : null}
      <ExportButtons period={period} revision={number} />
    </section>
    <Section id="rv-user" title={t('aa_sr_your_words')}>
      {revision.no_conclusion ? <p className="aa-sr-text">{t('aa_sr_no_conclusion')}</p> : null}
      {revision.reflection ? <p className="aa-sr-text aa-sr-reflection">{revision.reflection}</p> : null}
      {revision.decisions.length ? <><b className="aa-sr-text">{t('aa_sr_decisions')}</b>
        <ul className="aa-sr-codes">{revision.decisions.map((line, index) => <li key={index}>{line}</li>)}</ul></> : null}
      {revision.adjustments.length ? <><b className="aa-sr-text">{t('aa_sr_adjustments')}</b>
        <ul className="aa-sr-codes">{revision.adjustments.map((line, index) => <li key={index}>{line}</li>)}</ul></> : null}
      {!revision.decisions.length && !revision.adjustments.length ? <p className="aa-quiet">{t('aa_sr_nothing_chosen')}</p> : null}
    </Section>
    <Section id="rv-changed" title={t('aa_sr_changed')}>
      {(sections.changed ?? []).length ? <div className="aa-changes">
        {sections.changed.map(item => <ChangeCard key={item.ref ?? `r-${item.ordinal}`} item={item} names={names} readOnly />)}
      </div> : <Empty />}
    </Section>
    <Section id="rv-consequences" title={t('aa_sr_consequences')}>
      {(consequences.expenses ?? []).length ? consequences.expenses.map(analysis => analysis.redacted
        ? <p key={`r-${analysis.ordinal}`} className="aa-flag-erased">{t('aa_sr_source_deleted')}</p>
        : <article key={analysis.ref} className="aa-sr-expense">
          <span className="aa-sr-text"><b>{refText(analysis.ref, names, t)}</b></span>
          <div className="aa-sr-impacts">{analysis.impacts.map(impact => <ImpactCard key={impact.kind ?? impact.ordinal} impact={impact} />)}</div>
        </article>) : <Empty />}
    </Section>
    <Section id="rv-relations" title={t('aa_sr_relations')}>
      {(sections.relations ?? []).length ? <ul className="aa-sr-rels">{sections.relations.map(relation => relation.redacted
        ? <li key={`r-${relation.ordinal}`} className="aa-flag-erased">{t('aa_sr_source_deleted')}</li>
        : <li key={relation.id} className="aa-sr-rel">
          <KindMarker kind={relation.epistemic_kind} />
          <span className="aa-sr-text"> {refText(relation.from.key, names, t)} — {t(`aa_sr_rel_${relation.relation_type}`)} — {refText(relation.to.key, names, t)}</span>
          <span className="aa-quiet"> · {t(`aa_sr_status_rel_${relation.status}`)}{relation.note ? ` · «${relation.note}»` : ''}</span>
        </li>)}</ul> : <Empty />}
    </Section>
    <p className="aa-warn-note">{t('aa_sr_banner')}</p>
  </div>;
}
