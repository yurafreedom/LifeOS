/* System Review · evidence sections: what changed, improved, repeated, the
   trade-offs and data quality. Items are shown side by side in their own
   units; nothing here sums, averages or ranks across them. */

import React from 'react';
import AAImportance from '../../../components/analytics/AAImportance.jsx';
import { useAAText } from '../../../components/analytics/useAAText.js';
import {
  codeText,
  dateText,
  deltaText,
  instantText,
  periodTitle,
  refText,
  valueText,
} from './format.js';

export function Section({ id, title, note, children, className = '' }) {
  return <section className={`card panel aa-section aa-sr-section ${className}`.trim()} aria-labelledby={id}>
    <div className="aa-section-head">
      <h3 className="panel-title" id={id}>{title}</h3>
      {note ? <span className="aa-quiet">{note}</span> : null}
    </div>
    {children}
  </section>;
}

export function Empty() {
  const t = useAAText();
  return <p className="aa-none">{t('aa_sr_empty')}</p>;
}

function referenceLabel(item, t) {
  const concept = item.reference?.concept;
  return concept ? t(`aa_sr_ref_${concept}`) : null;
}

function DesireChip({ item }) {
  const t = useAAText();
  if (!item.basis || !['favorable', 'unfavorable'].includes(item.desire)) return null;
  return <span className="aa-tag aa-sr-desire" data-desire={item.desire}>
    {t(`aa_sr_desire_${item.desire}`)}
  </span>;
}

function ItemBody({ item }) {
  const t = useAAText();
  const details = item.details ?? {};
  switch (item.kind) {
    case 'finance_target_state':
      if (details.target_state !== 'present') {
        return <>
          <div className="aa-change-val">{valueText(item.current?.value, t)}</div>
          <div className="aa-quiet">{t(`aa_sr_target_${details.target_state}`)}</div>
        </>;
      }
      break;
    case 'project_forecast_revisions':
      return <>
        <div className="aa-change-val">{valueText(item.current?.value, t)}</div>
        <div className="aa-quiet">
          {t('aa_sr_forecast_from', valueText(item.reference?.value, t))}
          {' · '}{t('aa_sr_versions', details.versions_in_period)}
        </div>
        {item.delta?.state === 'known' ? <div className="aa-change-unit">{deltaText(item.delta, t)}</div> : null}
      </>;
    case 'project_completion':
      return <>
        <div className="aa-change-val">{valueText(item.current?.value, t)}</div>
        <div className="aa-quiet">
          {t('aa_sr_vs_first', deltaText(details.delta_vs_first, t))}
          {' · '}{t('aa_sr_vs_latest', deltaText(details.delta_vs_latest, t))}
        </div>
      </>;
    case 'experiment_lifecycle':
      return <ul className="aa-sr-events">
        {(details.events ?? []).map(event => <li key={event.event}>
          <span>{t(`aa_sr_exp_${event.event}`)}</span> <span className="aa-quiet">{instantText(event.at, t)}</span>
        </li>)}
      </ul>;
    case 'observation':
      return <>
        <div className="aa-sr-text">{item.current?.value ? valueText(item.current.value, t) : t('aa_sr_explicitly_unknown')}</div>
        <div className="aa-quiet">{codeText('epi', details.epistemic_kind, t)} · {instantText(details.occurred_at, t)}</div>
      </>;
    default:
      break;
  }
  const reference = referenceLabel(item, t);
  return <>
    <div className="aa-change-val">{valueText(item.current?.value, t)}</div>
    {reference ? <div className="aa-quiet">
      {reference}: {valueText(item.reference?.value, t)}
      {item.delta ? <> · <b>{deltaText(item.delta, t)}</b></> : null}
    </div> : null}
    {item.details?.expectation_is_not_a_target ? <div className="aa-quiet">{t('aa_sr_expectation_note')}</div> : null}
  </>;
}

export function ChangeCard({ item, names, importance, pendingImportance, onImportance, onLink, readOnly = false }) {
  const t = useAAText();
  if (item.redacted) {
    return <div className="aa-change is-redacted"><span className="aa-flag-erased">{t('aa_sr_source_deleted')}</span></div>;
  }
  const label = refText(item.ref, names, t);
  return <div className="aa-change" data-kind={item.kind}>
    <div className="aa-change-top">
      <span className="aa-signal-dot" />
      <span className="aa-change-dom">{t(`aa_sr_domain_${item.domain}`)}</span>
      {item.coverage && (item.coverage.partial > 0 || item.coverage.unknown_coverage > 0)
        ? <span className="aa-tag" data-kind="maybe">{t('aa_sr_partial')}</span> : null}
      <DesireChip item={item} />
    </div>
    <div className="aa-sr-text">{label}</div>
    <ItemBody item={item} />
    {item.basis ? <div className="aa-quiet">{t('aa_sr_basis_target', valueText(item.basis.reference, t), t(`aa_sr_dir_${item.basis.direction}`))}</div> : null}
    {readOnly ? null : <div className="aa-change-foot">
      <AAImportance value={importance?.importance ?? null} pending={pendingImportance ?? null}
        label={label} placement="left" onChange={value => onImportance(item.ref, value)} />
      <button type="button" className="aa-link aa-sr-link-btn" onClick={() => onLink(item.ref)}
        aria-label={t('aa_sr_link_aria', label)}>{t('aa_sr_link')}</button>
    </div>}
  </div>;
}

export function ChangedSection({ review, names, pending, actions, onLink }) {
  const t = useAAText();
  const { items, truncated } = review.sections.changed;
  return <Section id="sr-changed" title={t('aa_sr_changed')} note={t('aa_sr_changed_note')}>
    {items.length ? <div className="aa-changes">
      {items.map(item => <ChangeCard key={item.ref} item={item} names={names}
        importance={review.importance[item.ref]} pendingImportance={pending.importance[item.ref]}
        onImportance={actions.setImportance} onLink={onLink} />)}
    </div> : <Empty />}
    {truncated ? <p className="aa-quiet">{t('aa_sr_truncated')}</p> : null}
  </Section>;
}

export function ImprovedSection({ review, names }) {
  const t = useAAText();
  const items = review.sections.improved.items;
  return <Section id="sr-improved" title={t('aa_sr_improved')} note={t('aa_sr_improved_note')}>
    {items.length ? <div className="aa-sr-group">
      {items.map(item => <div className="aa-sr-item" key={item.ref}>
        <span>
          <span className="aa-sr-text">{refText(item.ref, names, t)}: <b>{valueText(item.current?.value, t)}</b></span>
          <span className="aa-quiet aa-sr-basis">{t('aa_sr_basis_target', valueText(item.basis?.reference, t), t(`aa_sr_dir_${item.basis?.direction}`))}</span>
        </span>
        <span className="aa-tag" data-kind="mine">{t('aa_sr_by_your_target')}</span>
      </div>)}
    </div> : <Empty />}
    <p className="aa-warn-note">{t('aa_sr_improved_warn')}</p>
  </Section>;
}

export function RepeatedSection({ review, names }) {
  const t = useAAText();
  const items = review.sections.repeated.items;
  return <Section id="sr-repeated" title={t('aa_sr_repeated')} note={t('aa_sr_repeated_note')}>
    {items.length ? <div className="aa-sr-group">
      {items.map((item, index) => <div className="aa-sr-item" key={`${item.source}-${index}`}>
        <span>
          <span className="aa-sr-text">{t(`aa_sr_rep_${item.kind}`, item.kind === 'forecast_revisions'
            ? (names.projects.get(String(item.subject_key).split(':')[2])?.title ?? t('aa_sr_project'))
            : t(`aa_sr_rule_${String(item.source).replaceAll('.', '_')}`))}</span>
          <span className="aa-quiet aa-sr-basis">
            {(item.windows ?? []).map(window => periodTitle(window.window, t)).join(', ')}
            {(item.coverage_unknown_windows ?? []).length
              ? ` · ${t('aa_sr_coverage_unknown_in', item.coverage_unknown_windows.map(key => periodTitle(key, t)).join(', '))}`
              : ''}
          </span>
        </span>
        <span className="aa-tag" data-kind="observed">{t('aa_sr_pattern_not_verdict')}</span>
      </div>)}
    </div> : <Empty />}
  </Section>;
}

function sideText(side, names, t) {
  if (side.kind === 'finance_target_state') {
    return `${refText(side.ref, names, t)}: ${valueText(side.current?.value, t)}`;
  }
  if (side.kind === 'payoff_after_planned_date' || side.kind === 'payoff_on_plan') {
    return t(`aa_sr_pri_${side.kind}`, dateText(side.projected_payoff_date, t), dateText(side.planned_payoff_date, t));
  }
  return t(`aa_sr_pri_${side.kind}`);
}

export function TradeoffsSection({ review, names }) {
  const t = useAAText();
  const items = review.sections.tradeoffs.items;
  return <Section id="sr-tradeoffs" title={t('aa_sr_tradeoffs')} note={t('aa_sr_tradeoffs_note')}>
    {items.length ? items.map((pair, index) => <div className="aa-sr-pair-block" key={index}>
      <div className="aa-pair">
        <div>
          <div className="aa-change-unit">{t('aa_sr_desire_favorable')}</div>
          <div className="aa-sr-text">{sideText(pair.a, names, t)}</div>
        </div>
        <div className="aa-pair-vs">{t('aa_sr_at_the_same_time')}</div>
        <div>
          <div className="aa-change-unit">{t('aa_sr_desire_unfavorable')}</div>
          <div className="aa-sr-text">{sideText(pair.b, names, t)}</div>
        </div>
      </div>
    </div>) : <Empty />}
    <p className="aa-warn-note">{t('aa_sr_causality_note')}</p>
  </Section>;
}

export function QualitySection({ review }) {
  const t = useAAText();
  const items = review.sections.quality.items;
  return <Section id="sr-quality" title={t('aa_sr_quality')} note={t('aa_sr_quality_note')}>
    {items.length ? <div className="aa-sr-group">
      {items.map((item, index) => <div className="aa-sr-item" key={index}>
        <span className="aa-sr-text">{item.kind === 'finance_coverage'
          ? t('aa_sr_quality_coverage', periodTitle(item.period, t), item.coverage.observed,
            item.coverage.expected_denominator, item.coverage.unknown_coverage)
          : t(`aa_sr_quality_${item.kind}`)}</span>
        <span className="aa-tag" data-kind="maybe">{t('aa_sr_quality_tag')}</span>
      </div>)}
    </div> : <Empty />}
    <p className="aa-none">{t('aa_sr_no_zero_fill')}</p>
  </Section>;
}
