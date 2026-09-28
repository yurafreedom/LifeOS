import React from 'react';
import { EPISTEMIC_KINDS } from '../../analytics/review';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/**
 * Epistemic tag with an explicit menu: наблюдение / моя трактовка / возможный
 * фактор / неизвестно / убрать фактор (frozen design decision 10).
 *
 * The kind is an interpretation label chosen by the user. It never implies a
 * cause, and «неизвестно» is a first-class choice rather than a missing value.
 * Keyboard: Enter/Space opens, ↑/↓ move, Escape closes and returns focus.
 */
export default function AAFactorTag({ kind = 'unknown', onChange, onRemove, readOnly = false }) {
  const t = useAAText();
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const menuId = React.useId();
  const label = t(`aa_pr_kind_${EPISTEMIC_KINDS.includes(kind) ? kind : 'unknown'}`);

  React.useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll('[role^="menuitem"]');
    const checked = menu.current?.querySelector('[aria-checked="true"]');
    (checked || items?.[0])?.focus();
  }, [open]);

  if (readOnly) return <span className="aa-tag" data-kind={kind}>{label}</span>;

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function onMenuKey(event) {
    const items = [...(menu.current?.querySelectorAll('[role^="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  }

  function onBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <span className="aa-tag-wrap" onBlur={onBlur}>
      <button
        type="button"
        ref={trigger}
        className="aa-tag"
        data-kind={kind}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('aa_rv_factor_kind', label)}
        onClick={() => setOpen(value => !value)}
      >
        {label} ▾
      </button>
      {open ? (
        <span className="aa-menu" role="menu" id={menuId} ref={menu} onKeyDown={onMenuKey}>
          {EPISTEMIC_KINDS.map(option => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === kind}
              className={`aa-menu-item${option === kind ? ' is-on' : ''}`}
              onClick={() => { onChange?.(option); close(); }}
            >
              <span>{t(`aa_pr_kind_${option}`)}</span>
              <span className="aa-quiet">{t(`aa_pr_kind_${option}_help`)}</span>
            </button>
          ))}
          {onRemove ? <span className="aa-menu-sep" role="separator" /> : null}
          {onRemove ? (
            <button
              type="button"
              role="menuitem"
              className="aa-menu-item is-danger"
              onClick={() => { close(); onRemove(); }}
            >
              {t('aa_pr_remove_factor')}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
