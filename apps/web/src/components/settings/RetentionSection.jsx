import React from 'react';
import {
  applyRetention,
  getRetentionPolicy,
  previewRetention,
  putRetentionPolicy,
} from '../../api/analytics';
import { ApiError } from '../../api/client';

const { useCallback, useEffect, useRef, useState } = React;

/*
 * Slice 8 · «Хранение аналитической истории».
 *
 * Separate from the activityLog cleanup in DangerSection: that trims the local
 * snapshot log, this governs durable Adaptive Analytics history. Unlimited is the
 * default; the only finite choices are 5 / 3 / 2 years. Saving a policy deletes
 * nothing. Deletion needs a preview and a second, explicit confirmation, and is a
 * direct online call — it is never queued for later.
 */

const TIMEZONE = 'Europe/Kyiv';
export const RETENTION_CHOICES = ['unlimited', 60, 36, 24];
const CONSEQUENCES = ['ret_c_measurements', 'ret_c_coverage', 'ret_c_versions',
  'ret_c_projects', 'ret_c_signals', 'ret_c_other'];
const DISCLOSURES = ['ret_d_finance', 'ret_d_projects', 'ret_d_reviews', 'ret_d_irreversible'];
const DEFAULT_CLIENT = { getRetentionPolicy, putRetentionPolicy, previewRetention, applyRetention };

export function mintRetentionKey() {
  const random = globalThis.crypto?.randomUUID?.();
  return `retention-${random || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function choiceLabel(choice, t) {
  return choice === 'unlimited' ? t('ret_unlimited') : t(`ret_months_${choice}`);
}

export function stateChoice(state) {
  return state && state.mode === 'finite' ? state.retain_months : 'unlimited';
}

function horizonFor(months, now = new Date()) {
  const index = now.getFullYear() * 12 + now.getMonth() - months;
  return new Date(Math.floor(index / 12), index % 12, 1);
}

function formatDate(value, t) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat(t('_intl_locale'), { day: 'numeric', month: 'long', year: 'numeric' })
    .format(date);
}

/** The PUT body for a choice. A finite policy carries the user's confirmation. */
export function policyBody(choice, state, understood, key) {
  if (choice === 'unlimited') return { mode: 'unlimited', idempotency_key: key };
  return { mode: 'finite', retain_months: choice, consequences_version: state.consequences_version,
    confirm_consequences: understood, idempotency_key: key };
}

/**
 * Apply, exactly once and only online. Offline, the client is never called and
 * nothing is queued: a destructive action confirmed now must not replay later.
 */
export async function runApply(client, { preview, key, online }) {
  if (!online) return { outcome: 'offline' };
  try {
    const run = await client.applyRetention({
      preview_token: preview.preview_token, timezone: TIMEZONE, idempotency_key: key,
    });
    return { outcome: run.status === 'completed' ? 'completed' : 'failed', run };
  } catch (failure) {
    if (failure instanceof ApiError && failure.code === 'retention_preview_stale') return { outcome: 'stale' };
    if (!(failure instanceof ApiError)) return { outcome: 'offline' };
    return { outcome: 'failed' };
  }
}

const OUTCOME_ERRORS = { offline: 'ret_offline', stale: 'ret_stale', failed: 'ret_failed' };

export function RunSummary({ run, t }) {
  if (!run) return null;
  if (run.status === 'failed') {
    return <p className="set-ret-run is-failed">
      {t('ret_run_failed', formatDate(run.failed_at || run.started_at, t), run.failure_code || '—')}
    </p>;
  }
  const counts = Object.entries(run.table_counts || {});
  return <div className="set-ret-run">
    <p className="set-ret-run-title">
      {t('ret_run_title', formatDate(run.completed_at || run.started_at, t),
        choiceLabel(run.retain_months, t))}
    </p>
    <ul className="set-ret-list">
      <li>{t('ret_run_deleted', run.total_deleted)}</li>
      {run.chain_count ? <li>{t('ret_run_chains', run.chain_count)}</li> : null}
      {run.project_unit_count ? <li>{t('ret_run_projects', run.project_unit_count)}</li> : null}
      {run.review_redaction_count ? <li>{t('ret_run_reviews', run.review_redaction_count)}</li> : null}
    </ul>
    {counts.length ? <details className="set-ret-details">
      <summary>{t('ret_run_details')}</summary>
      <dl>{counts.map(([table, count]) => <div key={table} className="set-ret-count">
        <dt>{t(`ret_t_${table}`)}</dt><dd className="mono">{count}</dd>
      </div>)}</dl>
    </details> : null}
  </div>;
}

function PreviewCounts({ preview, t }) {
  const nothing = preview.total_deleted === 0 && preview.review_redaction_count === 0
    && preview.system_review_redaction_count === 0 && preview.relation_redaction_count === 0;
  if (nothing) return <p className="set-ret-note" role="status">{t('ret_preview_zero')}</p>;
  return <div className="set-ret-preview" role="status">
    <p className="set-ret-run-title">{t('ret_preview_title')} · {t('ret_preview_horizon',
      formatDate(preview.target_horizon_date, t))}</p>
    <ul className="set-ret-list">
      <li>{t('ret_preview_total', preview.total_deleted)}</li>
      {preview.chain_count ? <li>{t('ret_preview_chains', preview.chain_count)}</li> : null}
      {preview.project_unit_count ? <li>{t('ret_preview_projects', preview.project_unit_count)}</li> : null}
      {preview.review_redaction_count ? <li>{t('ret_preview_reviews', preview.review_redaction_count)}</li> : null}
      {preview.system_review_redaction_count
        ? <li>{t('ret_preview_system', preview.system_review_redaction_count)}</li> : null}
      {preview.relation_redaction_count
        ? <li>{t('ret_preview_relations', preview.relation_redaction_count)}</li> : null}
    </ul>
  </div>;
}

/** Pure view of every state; the container below only wires data and handlers. */
export function RetentionView({ t, state, ui = {}, on = {}, confirmRef = null }) {
  const { choice = stateChoice(state), understood = false, busy = '', message = '', error = '',
    preview = null, confirming = false } = ui;
  const current = stateChoice(state);
  const changed = choice !== current;
  const finiteChoice = choice !== 'unlimited';
  const horizon = state.effective_horizon;
  const looser = horizon && (state.mode === 'unlimited'
    || (state.target_horizon_date && state.target_horizon_date < horizon.date));

  return <section className="set-ret" aria-labelledby="set-ret-title">
    <h3 id="set-ret-title" className="set-ret-h">{t('ret_title')}</h3>
    <p className="set-row-hint">{t('ret_intro')}</p>

    <fieldset className="set-ret-choices">
      <legend className="set-row-label">{t('ret_choice')}</legend>
      {RETENTION_CHOICES.map(option => <label key={option}
        className={`set-ret-choice${choice === option ? ' is-on' : ''}`}>
        <input type="radio" name="aa-retention" value={String(option)} checked={choice === option}
          onChange={() => on.choose?.(option)} disabled={Boolean(busy)} />
        <span>{choiceLabel(option, t)}</span>
        {option === 'unlimited' ? <span className="set-ret-tag mono">{t('ret_default')}</span> : null}
      </label>)}
    </fieldset>
    <p className="set-row-hint mono">
      {t('ret_current', choiceLabel(current, t))} · {state.source === 'default'
        ? t('ret_current_default') : t('ret_current_explicit')}
    </p>

    {changed && finiteChoice ? <div className="set-ret-card" role="group" aria-labelledby="set-ret-cons">
      <h4 id="set-ret-cons" className="set-ret-sub">{t('ret_consequences_title')}</h4>
      <p>{t('ret_consequences_intro', formatDate(horizonFor(choice), t))}</p>
      <ul className="set-ret-list">{CONSEQUENCES.map(key => <li key={key}>{t(key)}</li>)}</ul>
      <h4 className="set-ret-sub">{t('ret_keep_title')}</h4>
      <p>{t('ret_keep')}</p>
      <ul className="set-ret-list">{DISCLOSURES.map(key => <li key={key}>{t(key)}</li>)}</ul>
      <label className="set-ret-confirm">
        <input type="checkbox" checked={understood} onChange={event => on.understand?.(event.target.checked)} />
        <span>{t('ret_confirm_label')}</span>
      </label>
    </div> : null}

    {changed ? <div className="set-ret-actions">
      <button type="button" className="set-btn-ghost" onClick={on.save}
        disabled={Boolean(busy) || (finiteChoice && !understood)}>
        {busy === 'save' ? t('ret_saving') : t('ret_save')}
      </button>
    </div> : null}

    {!changed && state.mode === 'finite' ? <div className="set-ret-actions">
      <button type="button" className="set-btn-ghost" onClick={on.preview} disabled={Boolean(busy)}>
        {busy === 'preview' ? t('ret_previewing') : t('ret_preview')}
      </button>
    </div> : null}

    {preview && !changed ? <PreviewCounts preview={preview} t={t} /> : null}
    {preview && !changed && preview.total_deleted > 0 && !confirming ? <div className="set-ret-actions">
      <button type="button" className="set-btn-danger" onClick={on.askApply} disabled={Boolean(busy)}>
        {t('ret_apply')}
      </button>
    </div> : null}

    {confirming && preview ? <div className="set-ret-card is-danger" role="alertdialog"
      aria-labelledby="set-ret-confirm-h" aria-describedby="set-ret-confirm-p">
      <h4 id="set-ret-confirm-h" className="set-ret-sub" tabIndex={-1} ref={confirmRef}>{t('ret_confirm_title')}</h4>
      <p id="set-ret-confirm-p">{t('ret_confirm_text', preview.total_deleted)}</p>
      <div className="set-clear-confirm">
        <button type="button" className="set-btn-ghost" onClick={on.cancelApply}
          disabled={busy === 'apply'}>{t('ret_cancel')}</button>
        <button type="button" className="set-btn-danger" onClick={on.apply} disabled={busy === 'apply'}>
          {busy === 'apply' ? t('ret_applying') : t('ret_confirm_do')}
        </button>
      </div>
    </div> : null}

    <div aria-live="polite" className="set-ret-live">
      {message ? <p className="set-ret-note">{message}</p> : null}
      {error ? <p role="alert" className="set-ret-error">{error}</p> : null}
    </div>

    <div className="set-ret-status">
      <p className="set-ret-note">{horizon
        ? t('ret_horizon', formatDate(horizon.date, t)) : t('ret_horizon_none')}</p>
      {looser ? <p className="set-ret-note">{t('ret_horizon_differs')}</p> : null}
      {state.latest_run ? <>
        <h4 className="set-ret-sub">{t('ret_last_run')}</h4>
        <RunSummary run={state.latest_run} t={t} />
      </> : null}
    </div>
  </section>;
}

export function RetentionSection({ t, api }) {
  const client = useRef(api || DEFAULT_CLIENT).current;
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [ui, setUi] = useState({});
  const confirmRef = useRef(null);
  const applyKey = useRef('');
  const patch = next => setUi(previous => ({ ...previous, ...next }));

  const load = useCallback(async () => {
    try {
      const next = await client.getRetentionPolicy(TIMEZONE);
      setState(next);
      setLoadError('');
      return next;
    } catch {
      setLoadError(t('ret_load_failed'));
      return null;
    }
  }, [client, t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (ui.confirming) confirmRef.current?.focus(); }, [ui.confirming]);

  if (loadError) return <p role="alert" className="set-ret-error">{loadError}</p>;
  if (!state) return <p className="set-row-hint mono" role="status">{t('ret_loading')}</p>;
  const choice = ui.choice ?? stateChoice(state);

  const on = {
    choose: option => patch({ choice: option, understood: false, message: '', error: '' }),
    understand: value => patch({ understood: value }),
    async save() {
      patch({ busy: 'save', error: '' });
      try {
        const next = await client.putRetentionPolicy(
          policyBody(choice, state, Boolean(ui.understood), mintRetentionKey()));
        setState(next);
        patch({ busy: '', choice: undefined, understood: false, preview: null, message: t('ret_saved') });
      } catch {
        patch({ busy: '', error: t('ret_save_failed') });
      }
    },
    async preview() {
      patch({ busy: 'preview', error: '', message: '' });
      try {
        patch({ busy: '', preview: await client.previewRetention(TIMEZONE) });
      } catch {
        patch({ busy: '', error: t('ret_preview_failed') });
      }
    },
    askApply() {
      applyKey.current = mintRetentionKey();
      patch({ confirming: true, error: '' });
    },
    cancelApply: () => patch({ confirming: false }),
    async apply() {
      patch({ busy: 'apply', error: '' });
      const result = await runApply(client, {
        preview: ui.preview, key: applyKey.current, online: globalThis.navigator?.onLine !== false,
      });
      const keepPreview = result.outcome === 'offline';
      patch({ busy: '', confirming: false, preview: keepPreview ? ui.preview : null,
        error: OUTCOME_ERRORS[result.outcome] ? t(OUTCOME_ERRORS[result.outcome]) : '' });
      if (result.outcome !== 'offline') await load();
    },
  };

  return <RetentionView t={t} state={state} ui={{ ...ui, choice }} on={on} confirmRef={confirmRef} />;
}
