import React from 'react';
import { formatInstantDate } from '../analytics/projectAnalytics.ts';
import { canRestoreWaiting, isWaitingActive } from '../domain/waiting.ts';
import { LIcons } from './icons.jsx';
import { useDialog } from './useDialog.js';

/* Waiting For detail (GTD G1). Opened from Tasks → «ожидание».
 *
 * Active record: edit title + «от кого», then Save, or close it with an
 * outcome — получено / отменить ожидание / в задачу. Pending valid edits
 * travel WITH the outcome (one transition), so nothing typed is silently lost.
 * Closed record: read-only, «вернуть» for received/cancelled only (a converted
 * record already produced its Task), permanent delete after confirmation.
 *
 * Nothing is written until an action is pressed: ×, Escape, «отмена» and the
 * backdrop discard the draft. Save closes the dialog; an outcome keeps it open
 * on the closed record (Calendar Day Manager precedent: the result stays in
 * view and can be undone right here). Every outcome comes back from the
 * provider as applied | unchanged | invalid, and only `applied` is reported as
 * done. No sound is emitted here: the gesture arbiter voices the press. */

const { useEffect, useRef, useState } = React;

const ERROR_KEYS = {
  state_missing: 'waiting_err_generic',
  missing: 'waiting_err_missing',
  empty_title: 'waiting_err_empty_title',
  invalid_person: 'waiting_err_generic',
  invalid_resolution: 'waiting_err_generic',
  not_active: 'waiting_err_not_active',
  not_restorable: 'waiting_err_not_restorable',
  invalid_command: 'waiting_err_generic',
};

export const WAITING_RESOLUTION_KEYS = {
  received: 'waiting_res_received',
  cancelled: 'waiting_res_cancelled',
  converted: 'waiting_res_converted',
};

const APPLIED_KEYS = {
  update: 'waiting_status_saved',
  received: 'waiting_status_received',
  cancelled: 'waiting_status_cancelled',
  convert: 'waiting_status_converted',
  restore: 'waiting_status_restored',
  delete: 'waiting_status_deleted',
};

/** Localised message for a provider outcome, or null when there is nothing to say. */
export function waitingOutcomeMessage(outcome, command, t, title) {
  if (!outcome) return { tone: 'error', text: t('waiting_err_generic') };
  if (outcome.status === 'invalid') return { tone: 'error', text: t(ERROR_KEYS[outcome.code] || 'waiting_err_generic') };
  if (outcome.status === 'unchanged') {
    return { tone: 'info', text: t(command.kind === 'update' ? 'waiting_status_unchanged' : 'waiting_status_already') };
  }
  const key = command.kind === 'resolve' ? APPLIED_KEYS[command.resolution] : APPLIED_KEYS[command.kind];
  const name = command.kind === 'convert' && outcome.task ? outcome.task.title : title;
  return { tone: 'ok', text: t(key || 'waiting_status_saved', name) };
}

/** The edits a draft would apply — empty when nothing changed. */
export function waitingDraftChanges(item, draft) {
  const changes = {};
  if (draft.title !== item.title) changes.title = draft.title;
  const person = item.waiting_for || '';
  if (draft.person !== person) changes.waiting_for = draft.person;
  return changes;
}

export function WaitingItemModal({ item, t, intlLocale, onCommand, onClose, onDone }) {
  const I = LIcons;
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const headingRef = useRef(null);
  const confirmCancelRef = useRef(null);
  const busyRef = useRef(false);
  const [draft, setDraft] = useState(() => ({ title: item ? item.title : '', person: item ? item.waiting_for || '' : '' }));
  const [message, setMessage] = useState(null);
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refocus, setRefocus] = useState(0);

  const active = !!item && isWaitingActive(item);
  useDialog(dialogRef, { onClose, initialFocusRef: active ? titleRef : headingRef });

  /* An action that swaps the layout removes the pressed button; keep focus
     inside the dialog on its heading instead of dropping it to <body>. */
  useEffect(() => {
    if (refocus && headingRef.current) headingRef.current.focus();
  }, [refocus]);
  useEffect(() => {
    if (confirmDelete && confirmCancelRef.current) confirmCancelRef.current.focus();
  }, [confirmDelete]);

  function run(command, { closeOnApplied = false } = {}) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const outcome = onCommand(command);
      /* Name the record as it is now: an outcome can carry a rename made in the
         same transition. */
      const current = outcome && outcome.item ? outcome.item.title : (item ? item.title : '');
      const note = waitingOutcomeMessage(outcome, command, t, current);
      if (outcome && outcome.status === 'invalid' && outcome.code === 'empty_title') {
        setTitleError(true);
        setMessage(note);
        if (titleRef.current) titleRef.current.focus();
        return;
      }
      setTitleError(false);
      if (outcome && outcome.status !== 'invalid' && closeOnApplied) {
        onDone(outcome.status === 'applied' ? note : null);
        return;
      }
      setMessage(note);
      if (outcome && outcome.status === 'applied') {
        setConfirmDelete(false);
        if (outcome.item) {
          setDraft({ title: outcome.item.title, person: outcome.item.waiting_for || '' });
        }
        setRefocus(value => value + 1);
      }
    } finally {
      busyRef.current = false;
    }
  }

  const changes = item ? waitingDraftChanges(item, draft) : {};
  const pending = Object.keys(changes).length > 0 ? changes : undefined;

  function save(event) {
    if (event) event.preventDefault();
    if (!active) return;
    if (!pending) { onDone(null); return; }
    run({ kind: 'update', id: item.id, changes }, { closeOnApplied: true });
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(event);
  }

  const set = key => event => {
    const value = event.target.value;
    setDraft(prev => ({ ...prev, [key]: value }));
    if (key === 'title') setTitleError(false);
  };

  const created = item ? formatInstantDate(item.created_at, intlLocale) : '';

  return (
    <div className="qa-backdrop wt-backdrop" onMouseDown={onClose}>
      <form
        ref={dialogRef}
        className="qa-modal cal-editor wt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-heading"
        onMouseDown={event => event.stopPropagation()}
        onSubmit={save}
        onKeyDown={onKeyDown}
        noValidate>
        <div className="cal-dialog-head">
          <div className="wt-head-text">
            <div className="cal-dialog-eyebrow mono">{t('waiting_section_title')}{created ? ` · ${t('waiting_created', created)}` : ''}</div>
            <h2 className="cal-dialog-h wt-heading" id="wt-heading" ref={headingRef} tabIndex={-1}>
              {item ? item.title : t('waiting_section_title')}
            </h2>
          </div>
          <button type="button" className="qa-close" aria-label={t('waiting_modal_close')} onClick={onClose}>{I.x({ size: 14 })}</button>
        </div>

        {!item ? null : active ? (
          <>
            <label className="cal-field">
              <span className="cal-field-lab mono">{t('waiting_field_title')}</span>
              <input
                ref={titleRef}
                className="cal-input"
                value={draft.title}
                onChange={set('title')}
                aria-invalid={titleError ? 'true' : undefined}
                aria-describedby={titleError ? 'wt-message' : undefined} />
            </label>
            <label className="cal-field">
              <span className="cal-field-lab mono">{t('waiting_field_person')}</span>
              <input
                className="cal-input"
                value={draft.person}
                placeholder={t('waiting_field_person_ph')}
                onChange={set('person')} />
            </label>
            <div className="wt-outcomes" role="group" aria-labelledby="wt-outcomes-label">
              <span className="cal-field-lab mono" id="wt-outcomes-label">{t('waiting_outcomes')}</span>
              <div className="wt-outcome-row">
                <button type="button" className="cal-act"
                        onClick={() => run({ kind: 'resolve', id: item.id, resolution: 'received', changes: pending })}>
                  {I.check({ size: 13 })}<span>{t('waiting_act_received')}</span>
                </button>
                <button type="button" className="cal-act"
                        onClick={() => run({ kind: 'resolve', id: item.id, resolution: 'cancelled', changes: pending })}>
                  {I.x({ size: 13 })}<span>{t('waiting_act_cancel')}</span>
                </button>
                <button type="button" className="cal-act"
                        onClick={() => run({ kind: 'convert', id: item.id, changes: pending })}>
                  {I.chevRight({ size: 13 })}<span>{t('waiting_act_convert')}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="wt-closed">
            <p className="wt-closed-line">
              <span className={'wt-res is-' + item.resolution}>{t(WAITING_RESOLUTION_KEYS[item.resolution])}</span>
              <span className="mono wt-closed-date">{formatInstantDate(item.resolved_at, intlLocale)}</span>
            </p>
            {item.waiting_for ? <p className="wt-closed-person">{t('waiting_for', item.waiting_for)}</p> : null}
            {canRestoreWaiting(item) ? (
              <div className="wt-outcome-row">
                <button type="button" className="cal-act" onClick={() => run({ kind: 'restore', id: item.id })}>
                  <span>{t('waiting_restore')}</span>
                </button>
              </div>
            ) : (
              <p className="wt-closed-note">{t('waiting_converted_note')}</p>
            )}
          </div>
        )}

        <p className={'cal-status wt-message' + (message ? ' is-' + message.tone : '')}
           id="wt-message" role={message && message.tone === 'error' ? 'alert' : 'status'}>
          {!item ? t('waiting_err_missing') : message ? message.text : ''}
        </p>

        {item && confirmDelete ? (
          <div className="cal-confirm wt-confirm" role="group" aria-labelledby="wt-delete-q">
            <span id="wt-delete-q">{t('waiting_delete_q')}</span>
            <button type="button" className="cal-act" ref={confirmCancelRef} onClick={() => setConfirmDelete(false)}>{t('qa_cancel')}</button>
            <button type="button" className="cal-act is-danger-solid"
                    onClick={() => run({ kind: 'delete', id: item.id }, { closeOnApplied: true })}>
              {t('waiting_delete_yes')}
            </button>
          </div>
        ) : null}

        <div className="qa-foot wt-foot">
          {item && !confirmDelete ? (
            <button type="button" className="cal-act is-danger" onClick={() => setConfirmDelete(true)}>
              {I.trash({ size: 13 })}<span>{t('waiting_act_delete')}</span>
            </button>
          ) : <span />}
          <div className="qa-foot-actions">
            <button type="button" className="qa-btn-ghost" onClick={onClose}>{active ? t('qa_cancel') : t('waiting_modal_close')}</button>
            {active ? <button type="submit" className="qa-btn-save">{t('waiting_save')}</button> : null}
          </div>
        </div>
      </form>
    </div>
  );
}
