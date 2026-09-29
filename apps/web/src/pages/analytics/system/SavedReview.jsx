/* System Review · the user's own conclusions and the saved revisions.

   Saving appends a revision (draft or final); nothing earlier is rewritten.
   Decisions and adjustments are typed by the user only — the system never
   seeds or suggests them. «Вывода нет» and «ничего не выбрано» are valid ends. */

import React from 'react';
import { downloadRevisionExport } from '../../../api/analytics';
import { revisionHash, revisionRequest } from '../../../analytics/systemReviewFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { instantText } from './format.js';
import { Section } from './Sections.jsx';

const FORMATS = ['pdf', 'docx', 'xlsx', 'md'];

export function exportLocale(t) {
  return String(t('_intl_locale')).startsWith('uk') ? 'uk' : 'ru';
}

export function ExportButtons({ period, revision }) {
  const t = useAAText();
  const [state, setState] = React.useState({ busy: null, error: null });
  async function download(format) {
    setState({ busy: format, error: null });
    try {
      const { blob, filename } = await downloadRevisionExport(period, revision, format, exportLocale(t));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      setState({ busy: null, error: null });
    } catch (error) {
      setState({ busy: null, error });
    }
  }
  return <span className="aa-sr-export" role="group" aria-label={t('aa_sr_export', revision)}>
    <span className="aa-quiet">{t('aa_sr_export_label')}</span>
    {FORMATS.map(format => <button key={format} type="button" className="aa-tag" disabled={state.busy != null}
      aria-label={t('aa_sr_export_as', format.toUpperCase(), revision)} onClick={() => download(format)}>
      {state.busy === format ? '…' : format.toUpperCase()}
    </button>)}
    {state.error ? <span className="aa-exp-error" role="alert">{t('aa_sr_export_failed')}</span> : null}
  </span>;
}

function Lines({ label, hint, values, onChange, placeholder }) {
  const t = useAAText();
  const [draft, setDraft] = React.useState('');
  function add(event) {
    event.preventDefault();
    if (!draft.trim() || values.length >= 20) return;
    onChange([...values, draft.trim()]);
    setDraft('');
  }
  return <div className="aa-col">
    <div className="aa-block-head"><span className="aa-sr-text"><b>{label}</b></span><span className="aa-quiet">{hint}</span></div>
    {values.map((value, index) => <div className="aa-factor" key={`${index}-${value}`}>
      <span className="aa-factor-text">{value}</span>
      <button type="button" className="aa-tag" data-kind="unknown" aria-label={t('aa_sr_remove_line', value)}
        onClick={() => onChange(values.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <div className="aa-factor-add">
      <input className="aa-input" maxLength={500} value={draft} placeholder={placeholder} aria-label={label}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') add(event); }} />
      <button type="button" className="aa-tag" data-kind="unknown" onClick={add}>{t('aa_sr_add_line')}</button>
    </div>
  </div>;
}

export function SavedReviewSection({ review, pending, actions, analytics }) {
  const t = useAAText();
  const latest = review.saved.latest_revision;
  const [loaded, setLoaded] = React.useState(null);
  const [revisions, setRevisions] = React.useState([]);
  const [form, setForm] = React.useState({ reflection: '', noConclusion: false, decisions: [], adjustments: [] });
  const queued = pending.revisions[review.period];

  React.useEffect(() => {
    if (!analytics?.ready) return undefined;
    const controller = new window.AbortController();
    analytics.listRevisions(review.period, controller.signal)
      .then(body => setRevisions(body.revisions)).catch(() => {});
    if (latest) {
      analytics.readRevision(review.period, latest.revision, false, controller.signal).then(revision => {
        setLoaded(revision.revision);
        setForm({
          reflection: revision.reflection ?? '', noConclusion: revision.no_conclusion,
          decisions: revision.decisions, adjustments: revision.adjustments,
        });
      }).catch(() => {});
    }
    return () => controller.abort();
  }, [analytics?.ready, review.period, latest?.revision]);

  function save(finalize) {
    actions.enqueue(revisionRequest(review.period, {
      baseRevision: latest?.revision ?? null,
      finalize,
      reflection: form.reflection,
      noConclusion: form.noConclusion,
      decisions: form.decisions,
      adjustments: form.adjustments,
    }));
  }

  const ended = review.period_state === 'ended';
  const finalized = review.status === 'FINALIZED';
  return <Section id="sr-saved" title={t('aa_sr_saved')} note={t('aa_sr_saved_note')}>
    <div className="aa-field">
      <label className="aa-sr-text" htmlFor="sr-reflection"><b>{t('aa_sr_reflection')}</b></label>
      <textarea id="sr-reflection" className="aa-textarea" maxLength={4000} value={form.reflection}
        disabled={form.noConclusion} placeholder={t('aa_sr_reflection_placeholder')}
        onChange={event => setForm(previous => ({ ...previous, reflection: event.target.value }))} />
    </div>
    <button type="button" role="checkbox" aria-checked={form.noConclusion}
      className={`aa-checkline${form.noConclusion ? ' is-on' : ''}`}
      onClick={() => setForm(previous => ({ ...previous, noConclusion: !previous.noConclusion }))}>
      <span className="aa-checkbox" aria-hidden="true" />
      <span className="aa-sr-text">{t('aa_sr_no_conclusion')}</span>
    </button>
    <Lines label={t('aa_sr_decisions')} hint={t('aa_sr_decisions_hint')} values={form.decisions}
      placeholder={t('aa_sr_decisions_placeholder')}
      onChange={decisions => setForm(previous => ({ ...previous, decisions }))} />
    <Lines label={t('aa_sr_adjustments')} hint={t('aa_sr_adjustments_hint')} values={form.adjustments}
      placeholder={t('aa_sr_adjustments_placeholder')}
      onChange={adjustments => setForm(previous => ({ ...previous, adjustments }))} />
    {!form.decisions.length && !form.adjustments.length ? <p className="aa-quiet">{t('aa_sr_nothing_chosen')}</p> : null}
    {queued ? <p className="aa-quiet" role="status">{t('aa_sr_save_pending')}</p> : null}
    <div className="aa-actions">
      <span className="aa-quiet">{latest ? t('aa_sr_based_on', loaded ?? latest.revision) : t('aa_sr_first_save')}</span>
      <span className="aa-actions-right">
        <button type="button" className="aa-btn aa-btn-ghost" disabled={actions.busy || Boolean(queued)}
          onClick={() => save(false)}>{t('aa_sr_save_draft')}</button>
        <button type="button" className="aa-btn aa-btn-primary" disabled={actions.busy || Boolean(queued) || !ended}
          title={ended ? undefined : t('aa_sr_finalize_after_end')}
          onClick={() => save(true)}>{t(finalized ? 'aa_sr_revise' : 'aa_sr_finalize')}</button>
      </span>
    </div>
    {!ended ? <p className="aa-quiet">{t('aa_sr_finalize_after_end')}</p> : null}
    <div className="aa-col">
      <span className="aa-eyebrow">{t('aa_sr_history')}</span>
      {revisions.length ? <ul className="aa-review-list">{[...revisions].reverse().map(item => <li key={item.revision} className="aa-sr-rev">
        <a className="aa-link" href={revisionHash(review.period, item.revision)}>
          {t('aa_sr_revision_n', item.revision)} · {t(`aa_sr_rev_${item.status}`)}
        </a>
        <span className="aa-quiet">{instantText(item.created_at, t)}{item.redacted_at ? ` · ${t('aa_sr_has_redactions')}` : ''}</span>
        <ExportButtons period={review.period} revision={item.revision} />
      </li>)}</ul> : <p className="aa-quiet">{t('aa_sr_no_revisions')}</p>}
    </div>
  </Section>;
}
