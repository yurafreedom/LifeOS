import React from 'react';
import { LIcons } from './icons.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const {
  useState: useStateCP,
  useEffect: useEffectCP,
  useContext: useCtxCP,
  useRef: useRefCP,
  useMemo: useMemoCP,
} = React;

/* Clarify panel — the GTD «прояснить» step for a Quick Note.
 *
 * Approved handoff layout 1c: a vertical list of the six outcomes inside a
 * modal popover. Delete arms a confirmation block below the list; Defer opens a
 * date block in the same place. Everything else applies on one tap.
 *
 * Reuses the production modal chrome (.qa-backdrop / .qa-modal) so theme,
 * paradise and mobile-sheet behaviour come from the existing design system
 * rather than a second one. */

/* Domain failure code → localised copy. Anything unmapped falls back to the
   generic line; a raw English Error message never reaches the UI. */
const CLARIFY_ERROR_KEYS = {
  state_missing: 'clarify_error_state',
  stale_note:    'clarify_error_stale',
  empty_note:    'clarify_error_empty',
  defer_missing: 'clarify_defer_required',
  defer_invalid: 'clarify_error_defer_invalid',
  defer_past:    'clarify_error_defer_past',
};

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function ClarifyPanel({
  note,
  onClose,
  onDoNow,
  onDelegate,
  onDefer,
  onProject,
  onReference,
  onDelete,
}) {
  const { t } = useCtxCP(LifeLocaleContext);
  const I = LIcons;
  /* 'idle' | 'defer' | 'confirm-delete' — only one expansion at a time, which
     is what the handoff's single `confirmingDelete` flag becomes once Defer
     needs an explicit date too. */
  const [step, setStep] = useStateCP('idle');
  const [deferDate, setDeferDate] = useStateCP('');
  const [error, setError] = useStateCP(null);
  const [busy, setBusy] = useStateCP(false);

  const panelRef = useRefCP(null);
  const firstActionRef = useRefCP(null);
  const deferInputRef = useRefCP(null);
  const busyRef = useRefCP(false);
  const returnFocusRef = useRefCP(null);

  const rows = useMemoCP(() => [
    {
      id: 'do_now',
      icon: I.zap,
      label: t('clarify_do_now'),
      hint: t('clarify_do_now_hint'),
      run: () => onDoNow(note),
    },
    {
      id: 'delegate',
      icon: I.user,
      label: t('clarify_delegate'),
      hint: t('clarify_delegate_hint'),
      run: () => onDelegate(note),
    },
    {
      id: 'defer',
      icon: I.clock,
      label: t('clarify_defer'),
      hint: t('clarify_defer_hint'),
      expands: 'defer',
    },
    {
      id: 'project',
      icon: I.briefcase,
      label: t('clarify_project'),
      hint: t('clarify_project_hint'),
      run: () => onProject(note),
    },
    {
      id: 'reference',
      icon: I.bookOpen,
      label: t('clarify_reference'),
      hint: t('clarify_reference_hint'),
      run: () => onReference(note),
    },
    {
      id: 'delete',
      icon: I.trash,
      label: t('clarify_delete'),
      hint: t('clarify_delete_hint'),
      expands: 'confirm-delete',
      danger: true,
    },
  ], [I, t, note, onDoNow, onDelegate, onProject, onReference]);

  /* Initial focus on the first action (handoff), with focus returned to the
     inbox row that opened the panel. */
  useEffectCP(() => {
    returnFocusRef.current = document.activeElement;
    const id = setTimeout(() => {
      firstActionRef.current && firstActionRef.current.focus();
    }, 30);
    return () => {
      clearTimeout(id);
      const target = returnFocusRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus();
      }
    };
  }, []);

  useEffectCP(() => {
    if (step === 'defer') {
      const id = setTimeout(() => deferInputRef.current && deferInputRef.current.focus(), 30);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [step]);

  /* Escape first collapses an open expansion, then closes the panel. Neither
     path mutates the source note. Tab wraps inside the dialog but Escape
     always leaves, so this is not a keyboard trap. Digits 1–6 pick an outcome
     unless the user is typing in a field. */
  useEffectCP(() => {
    function handler(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (step !== 'idle') { setStep('idle'); setError(null); return; }
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const root = panelRef.current;
        if (!root) return;
        const items = Array.from(root.querySelectorAll(FOCUSABLE))
          .filter(element => element.offsetParent !== null || element === document.activeElement);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = '123456'.indexOf(event.key);
      if (index >= 0) {
        event.preventDefault();
        choose(rows[index]);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (cause) {
      /* Source note untouched — the transition validates before it writes. */
      const key = cause && CLARIFY_ERROR_KEYS[cause.code];
      setError(t(key || 'clarify_failed'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function choose(row) {
    if (!row || busyRef.current) return;
    setError(null);
    if (row.expands) {
      setStep(current => (current === row.expands ? 'idle' : row.expands));
      return;
    }
    run(row.run);
  }

  function submitDefer(event) {
    event.preventDefault();
    if (!deferDate) { setError(t('clarify_defer_required')); return; }
    setError(null);
    run(() => onDefer(note, deferDate));
  }

  const captured = note.at
    ? `${t('clarify_captured')} · ${note.at}`
    : t('clarify_captured');

  return (
    <div className="qa-backdrop clarify-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="qa-modal clarify-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarify-eyebrow clarify-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="clarify-head">
          <span className="clarify-eyebrow mono" id="clarify-eyebrow">{t('clarify_eyebrow')}</span>
          <button
            type="button"
            className="clarify-close"
            onClick={onClose}
            aria-label={t('clarify_close')}
            title={t('clarify_close')}
          >
            <I.x size={15} />
          </button>
        </div>

        <div className="clarify-source">
          <h2 className="clarify-note-title" id="clarify-title">{note.text}</h2>
          <p className="clarify-note-meta mono">{captured}</p>
        </div>

        <p className="clarify-hint">
          <span className="clarify-hint-icon" aria-hidden="true"><I.zap size={16} /></span>
          <span>{t('clarify_two_minute_hint')}</span>
        </p>

        <p className="clarify-choose mono" id="clarify-choose">{t('clarify_choose')}</p>

        <div className="clarify-list" role="group" aria-labelledby="clarify-choose">
          {rows.map((row, index) => {
            const expanded = row.expands ? step === row.expands : undefined;
            return (
              <button
                key={row.id}
                type="button"
                ref={index === 0 ? firstActionRef : null}
                className={'clarify-row'
                  + (index === 0 ? ' is-primary' : '')
                  + (row.danger ? ' is-danger' : '')
                  + (expanded ? ' is-open' : '')}
                onClick={() => choose(row)}
                disabled={busy}
                aria-expanded={expanded}
                aria-controls={row.expands ? `clarify-panel-${row.expands}` : undefined}
              >
                <span className="clarify-row-icon" aria-hidden="true">{row.icon({ size: 16 })}</span>
                <span className="clarify-row-body">
                  <span className="clarify-row-label">{row.label}</span>
                  <span className="clarify-row-hint">{row.hint}</span>
                </span>
                <span className="clarify-row-key mono" aria-hidden="true">{index + 1}</span>
                <span className="clarify-row-chev" aria-hidden="true"><I.chevRight size={16} /></span>
              </button>
            );
          })}
        </div>

        {step === 'defer' && (
          <form
            id="clarify-panel-defer"
            className="clarify-expand clarify-defer"
            onSubmit={submitDefer}
          >
            <span className="clarify-expand-icon" aria-hidden="true"><I.clock size={17} /></span>
            <span className="clarify-expand-body">
              <label className="clarify-expand-title" htmlFor="clarify-defer-date">
                {t('clarify_defer_title')}
              </label>
              <input
                ref={deferInputRef}
                id="clarify-defer-date"
                className="clarify-defer-input mono"
                type="date"
                value={deferDate}
                onChange={event => setDeferDate(event.target.value)}
                required
              />
              <span className="clarify-expand-copy">{t('clarify_defer_copy')}</span>
            </span>
            <span className="clarify-expand-actions">
              <button
                type="button"
                className="clarify-btn-ghost"
                onClick={() => { setStep('idle'); setError(null); }}
                disabled={busy}
              >
                {t('clarify_cancel')}
              </button>
              <button type="submit" className="clarify-btn-primary" disabled={busy || !deferDate}>
                {t('clarify_defer_confirm')}
              </button>
            </span>
          </form>
        )}

        {step === 'confirm-delete' && (
          <div
            id="clarify-panel-confirm-delete"
            className="clarify-expand clarify-confirm"
            role="group"
            aria-labelledby="clarify-confirm-title"
          >
            <span className="clarify-expand-icon" aria-hidden="true"><I.alertTriangle size={17} /></span>
            <span className="clarify-expand-body">
              <span className="clarify-expand-title" id="clarify-confirm-title">
                {t('clarify_delete_title')}
              </span>
              <span className="clarify-expand-copy">{t('clarify_delete_copy')}</span>
            </span>
            <span className="clarify-expand-actions">
              <button
                type="button"
                className="clarify-btn-ghost"
                onClick={() => { setStep('idle'); setError(null); }}
                disabled={busy}
              >
                {t('clarify_cancel')}
              </button>
              <button
                type="button"
                className="clarify-btn-danger"
                onClick={() => run(() => onDelete(note))}
                disabled={busy}
              >
                {t('clarify_delete_confirm')}
              </button>
            </span>
          </div>
        )}

        {error && (
          <p className="clarify-error" role="alert">
            <span className="clarify-error-icon" aria-hidden="true"><I.alertTriangle size={15} /></span>
            <span>{error}</span>
          </p>
        )}

        <div className="clarify-foot">
          <span className="clarify-foot-label mono">{t('clarify_foot')}</span>
          <span className="clarify-kbd mono">esc</span>
        </div>
      </div>
    </div>
  );
}

export { ClarifyPanel };
