import React from 'react';

/* Shown by a task editor when a field the user edited was ALSO changed in the
 * persisted task while the editor was open (domain/editDraft.ts). Nothing has
 * been saved: the draft stays in the form, and the user picks per notice —
 * take the saved values, or keep theirs (saved over the new values). */

/** Human text of a saved value; `format` may override per field. */
export function conflictValueText(field, value, t, format) {
  const custom = format ? format(field, value) : undefined;
  if (custom !== undefined) return custom;
  if (field === 'schedule') return value && value.date ? [value.date, value.time].filter(Boolean).join(' ') : t('edit_conflict_no_date');
  return value ? String(value) : t('edit_conflict_empty');
}

export function EditConflictNotice({ conflicts, labels, t, format, onResolve }) {
  return (
    <div className="cal-confirm edit-conflict" role="alert">
      <span>{t('edit_conflict_q')}</span>
      <ul className="edit-conflict-list">
        {conflicts.map(c => (
          <li key={c.field}>{t('edit_conflict_field', t(labels[c.field]), conflictValueText(c.field, c.saved, t, format))}</li>
        ))}
      </ul>
      <div className="edit-conflict-actions">
        <button type="button" className="qa-btn-ghost" onClick={() => onResolve('saved')}>{t('edit_conflict_saved')}</button>
        <button type="button" className="qa-btn-ghost" onClick={() => onResolve('mine')}>{t('edit_conflict_mine')}</button>
      </div>
    </div>
  );
}
