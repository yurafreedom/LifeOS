import React from 'react';
import { IMPORTANCE } from '../../analytics/systemReviewFacts';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/**
 * User-owned importance (frozen J): не решил / для меня важно / приемлемо /
 * не считаю значимым. A word, never a number; it orders nothing on its own.
 *
 * `value` is the server's active rating (null = no rating, i.e. «не решил»);
 * `pending` shows an answer that is queued but not yet acknowledged.
 * Keyboard: Enter/Space opens, ↑/↓ move, Escape closes and returns focus.
 */
export default function AAImportance({ value = null, pending = null, onChange, placement = 'right', label: itemLabel = '' }) {
  const t = useAAText();
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const menuId = React.useId();
  const shown = pending ?? value ?? 'none';
  const label = t(`aa_sr_imp_${shown}`);

  React.useEffect(() => {
    if (!open) return;
    const checked = menu.current?.querySelector('[aria-checked="true"]');
    (checked || menu.current?.querySelector('[role="menuitemradio"]'))?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function onMenuKey(event) {
    const items = [...(menu.current?.querySelectorAll('[role="menuitemradio"]') ?? [])];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }

  return (
    <span className="aa-tag-wrap" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        type="button"
        ref={trigger}
        className="aa-tag"
        data-kind={shown !== 'none' ? 'mine' : 'unknown'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('aa_sr_imp_aria', itemLabel, label)}
        disabled={!onChange}
        onClick={() => setOpen(current => !current)}
      >
        {label}{pending ? ` · ${t('aa_sr_pending_short')}` : ''} ▾
      </button>
      {open ? (
        <span className={`aa-menu${placement === 'left' ? ' is-left' : ''}`} role="menu" id={menuId}
          ref={menu} onKeyDown={onMenuKey}>
          {IMPORTANCE.map(option => (
            <button key={option} type="button" role="menuitemradio" aria-checked={option === shown}
              className={`aa-menu-item${option === shown ? ' is-on' : ''}`}
              onClick={() => { onChange?.(option); close(); }}>
              <span>{t(`aa_sr_imp_${option}`)}</span>
              {option === 'none' ? <span className="aa-quiet">{t('aa_sr_imp_none_help')}</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
