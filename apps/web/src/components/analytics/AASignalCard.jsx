import React from 'react';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import AAProvenance from './AAProvenance.jsx';
import '../../analytics.css';

/**
 * The accepted Signal Card.
 *
 * The server sends values, never copy, so every sentence here is composed from
 * `rule_id` plus `rendered_values` against the ru/uk dictionaries. That is also
 * why the card knows the four rules by name: the *shape* of a signal's sentence
 * is a product decision per rule, and the alternative — sending rendered Russian
 * from the API — would strand the Ukrainian locale.
 *
 * Three dimensions stay independent, exactly as the frozen design requires:
 *
 * - `state` is the visual family (`normal`, `material`, `info`, `stale`,
 *   `partial`, `resolved`).
 * - `materiality` is weight, and composes on top of a data-quality family so a
 *   stale card can read as informational or as material.
 * - `stakes` is the single warm case, and the rule sets it only when the
 *   underlying event itself qualifies. Analytics never borrows stakes orange to
 *   mean «large», and a delta's sign never colours desirability.
 */

const RULE_FINANCE = 'finance.monthly_spend.threshold';
const RULE_FORECAST = 'project.forecast.revision';
const RULE_STALE = 'data.source.stale';
const RULE_COVERAGE = 'coverage.window.partial';

const WEIGHT_KEY = {
  normal: 'aa_sig_weight_normal',
  info: 'aa_sig_weight_info',
  material: 'aa_sig_weight_material',
};

const FINANCE_TITLE = {
  80: 'aa_sig_fin_title_80',
  100: 'aa_sig_fin_title_100',
  120: 'aa_sig_fin_title_120',
};

/** `is-normal` is not a class: the base card carries no modifier. */
export function signalClassName(signal) {
  const classes = ['aa-signal'];
  if (signal.state !== 'normal') classes.push(`is-${signal.state}`);
  // A data-quality family keeps its own look and takes weight as a second class,
  // which is how the frozen gallery composes `is-stale` with a tier.
  if ((signal.state === 'stale' || signal.state === 'partial') && signal.materiality !== 'normal') {
    classes.push(`is-${signal.materiality}`);
  }
  if (signal.stakes && signal.state !== 'resolved') classes.push('is-stakes');
  return classes.join(' ');
}

function money(amount, unitCode, locale) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return String(amount ?? '—');
  const formatted = parsed.toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
    maximumFractionDigits: 0,
  });
  return unitCode === 'UAH' ? `₴${formatted}` : `${formatted} ${unitCode || ''}`.trim();
}

function localDate(iso, locale) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function dayGap(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86400000);
}

/** The domain eyebrow. A project's own name lives in the snapshot, not in AA. */
function domainLabel(signal, t, locale, subjectTitle) {
  if (signal.rule_id === RULE_FINANCE || signal.subject_domain === 'finance') {
    const period = signal.rendered_values.period || signal.rendered_values.window_id
      || signal.subject_id;
    return t('aa_sig_domain_finance', monthLabel(period, locale));
  }
  if (signal.subject_domain === 'project') {
    return subjectTitle || t('aa_sig_domain_project');
  }
  return t('aa_sig_domain_unknown');
}

function monthLabel(period, locale) {
  if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return String(period ?? '');
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    locale === 'uk' ? 'uk-UA' : 'ru-RU',
    { month: 'long' },
  );
}

/**
 * Compose one card's sentence.
 *
 * Returns `{ title, from, to, magnitude, body, tag }` — every field already
 * localized, and every field derived from values the rule supplied. Nothing here
 * invents a number the evaluation did not report.
 */
export function signalCopy(signal, t, locale) {
  const v = signal.rendered_values || {};
  if (signal.rule_id === RULE_FINANCE) {
    const days = Number(v.days_remaining);
    return {
      title: t(FINANCE_TITLE[v.band] || 'aa_sig_fin_title_100'),
      from: money(v.reference, v.unit_code, locale),
      to: money(v.spend, v.unit_code, locale),
      magnitude: days > 0
        ? t('aa_sig_fin_mag_days', days, t.pl('pl_day', days))
        : t('aa_sig_fin_mag_last_day'),
      body: v.reference_kind === 'target'
        ? t('aa_sig_fin_basis_target')
        : t('aa_sig_fin_basis_expect'),
    };
  }
  if (signal.rule_id === RULE_FORECAST) {
    const shift = dayGap(v.from, v.to);
    const magnitude = shift == null || shift === 0
      ? null
      : t(shift > 0 ? 'aa_sig_fc_mag_later' : 'aa_sig_fc_mag_earlier',
          Math.abs(shift), t.pl('pl_day', Math.abs(shift)));
    return {
      title: t(v.from ? 'aa_sig_fc_title' : 'aa_sig_fc_title_first'),
      from: v.from ? localDate(v.from, locale) : null,
      to: localDate(v.to, locale),
      magnitude,
      body: Number(v.revision_count) > 1
        ? t('aa_sig_fc_revisions', v.revision_count)
        : null,
    };
  }
  if (signal.rule_id === RULE_STALE) {
    const days = Number(v.days_stale) || 0;
    return {
      title: t('aa_sig_stale_title'),
      body: t('aa_sig_stale_body', days, t.pl('pl_day', days)),
      timestamp: t('aa_sig_stale_ts', days, t.pl('pl_day', days)),
      tag: { kind: 'maybe', label: t('aa_sig_state_stale') },
    };
  }
  if (signal.rule_id === RULE_COVERAGE) {
    const elapsed = Number(v.elapsed) || 0;
    const future = Number(v.future_days) || 0;
    const body = [t('aa_sig_cov_body')];
    // «future ≠ missing»: days that have not happened are stated, never counted
    // against the fraction.
    if (future > 0) body.push(t('aa_sig_cov_future', future, t.pl('pl_day', future)));
    return {
      title: t('aa_sig_cov_title', v.observed, elapsed, t.pl('pl_day', elapsed)),
      body: body.join(' '),
      tag: { kind: 'maybe', label: t('aa_sig_state_partial') },
    };
  }
  return { title: signal.rule_id };
}

/** Provenance in the accepted four-row grammar, from what the rule reported. */
function provenanceFor(signal) {
  const p = signal.provenance || {};
  const kinds = Array.isArray(p.source_kinds) ? p.source_kinds : [];
  const parts = [];
  if (p.operation_count != null) parts.push(`${p.operation_count}`);
  if (p.forecast_version_count != null) parts.push(`${p.forecast_version_count}`);
  if (p.claim_count != null) parts.push(`${p.claim_count}`);
  if (p.observed != null && p.denominator != null) parts.push(`${p.observed} / ${p.denominator}`);
  if (p.fact_count != null) parts.push(`${p.fact_count}`);
  return {
    source_kind: p.derived_by === 'lifeos' ? 'DERIVED' : (kinds.join(' · ') || 'UNKNOWN'),
    basis: parts.join(' · ') || null,
    method: p.derivation || null,
    recorded_at: p.newest_recorded_at || signal.last_evaluated_at,
    source_ref: null,
    original_recorded_at_known: true,
  };
}

/**
 * `t` and `locale` come from one place on purpose. Taking them as two separate
 * props let a caller pass a Russian `t` alongside `locale="uk"` and render a
 * half-translated card, so the component reads the locale context itself.
 */
export default function AASignalCard({
  signal,
  subjectTitle = null,
  narrow = false,
  onOpen,
  onDismiss,
  busy = false,
}) {
  const { t, locale } = React.useContext(LifeLocaleContext);
  const copy = signalCopy(signal, t, locale);
  const resolved = signal.state === 'resolved';
  const tag = resolved
    ? { kind: 'observed', label: t('aa_sig_state_resolved') }
    : copy.tag;
  const timestamp = copy.timestamp || localDate(signal.first_seen_at, locale);
  const weight = t(WEIGHT_KEY[signal.materiality] || 'aa_sig_weight_normal');
  const domain = domainLabel(signal, t, locale, subjectTitle);

  return (
    <article
      className={signalClassName(signal)}
      data-rule={signal.rule_id}
      data-state={signal.state}
      data-materiality={signal.materiality}
      aria-label={`${t('aa_sig_group')}: ${copy.title}`}
    >
      <div className="aa-signal-top">
        <span className="aa-signal-dot" aria-hidden="true" />
        <span className="aa-signal-domain">{domain}</span>
        {tag ? <span className="aa-tag" data-kind={tag.kind}>{tag.label}</span> : null}
        {/* State is carried by more than colour: it is also named here. */}
        <span className="aa-sr-only">{weight}</span>
      </div>
      <h3 className="aa-signal-title">{copy.title}</h3>
      {!resolved && (copy.from || copy.to) ? (
        <p className="aa-signal-body">
          {copy.from ? <span className="aa-delta-strike">{copy.from}</span> : null}
          {copy.from ? <span className="aa-signal-arrow"> → </span> : null}
          <span className="aa-signal-to">{copy.to}</span>
          {copy.magnitude ? <span className="aa-signal-mag">{copy.magnitude}</span> : null}
        </p>
      ) : null}
      {!resolved && copy.body ? <p className="aa-signal-body">{copy.body}</p> : null}
      <div className="aa-signal-foot">
        {timestamp ? <span className="aa-signal-ts">{timestamp}</span> : null}
        <AAProvenance provenance={provenanceFor(signal)} narrow={narrow} />
        {!resolved && onOpen ? (
          <button type="button" className="aa-link" onClick={() => onOpen(signal)}>
            {t('aa_sig_open')}
          </button>
        ) : null}
        {!resolved && onDismiss ? (
          <button
            type="button"
            className="aa-link aa-link-quiet"
            disabled={busy}
            onClick={() => onDismiss(signal)}
          >
            {t('aa_sig_dismiss')}
          </button>
        ) : null}
      </div>
    </article>
  );
}
