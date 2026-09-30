/* Editor drafts against a persisted record that can change while the editor
 * is open (sync, another tab, another surface).
 *
 * An editor keeps a `baseline` — the persisted values its fields showed when
 * the user started from them — next to its `draft`. Per field:
 *   draft == baseline                  untouched → the latest value stays
 *   latest == baseline                 edited    → apply the draft
 *   latest == draft                    both sides made the same change → no-op
 *   otherwise                          conflict  → the caller must ask
 * Values are compared structurally (a schedule is ONE {date, time} value, so
 * date and time are never merged separately). */

export type DraftValues = Record<string, unknown>;
export type DraftConflict = { field: string; mine: unknown; saved: unknown };
export type DraftReconcile = { apply: string[]; conflicts: DraftConflict[] };

export function sameDraftValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function reconcileDraft(baseline: DraftValues, draft: DraftValues, latest: DraftValues, fields: string[]): DraftReconcile {
  const apply: string[] = [];
  const conflicts: DraftConflict[] = [];
  for (const field of fields) {
    if (sameDraftValue(draft[field], baseline[field])) continue;
    if (sameDraftValue(latest[field], baseline[field])) apply.push(field);
    else if (!sameDraftValue(latest[field], draft[field])) conflicts.push({ field, mine: draft[field], saved: latest[field] });
  }
  return { apply, conflicts };
}

/* Untouched fields follow the persisted record: both draft and baseline move
   to the latest value, so the form shows what is actually saved. Edited
   fields keep their draft and the baseline they started from. Returns null
   when nothing moved (callers skip the state update). */
export function rebaseUntouched<T extends DraftValues>(baseline: T, draft: T, latest: T, fields: string[]): { baseline: T; draft: T } | null {
  let moved = false;
  const nextBaseline: DraftValues = { ...baseline };
  const nextDraft: DraftValues = { ...draft };
  for (const field of fields) {
    if (!sameDraftValue(draft[field], baseline[field]) || sameDraftValue(latest[field], baseline[field])) continue;
    nextBaseline[field] = latest[field];
    nextDraft[field] = latest[field];
    moved = true;
  }
  return moved ? { baseline: nextBaseline as T, draft: nextDraft as T } : null;
}

/* The user's answer to a conflict. 'mine' re-bases the conflicting fields on
   the value now saved (the next save writes the draft over it — explicitly,
   and only if nothing changed again meanwhile); 'saved' takes the persisted
   value into the draft. Other fields are left as they are. */
export function resolveDraftConflicts<T extends DraftValues>(
  baseline: T, draft: T, latest: T, fields: string[], choice: 'mine' | 'saved',
): { baseline: T; draft: T } {
  const nextBaseline: DraftValues = { ...baseline };
  const nextDraft: DraftValues = { ...draft };
  for (const field of fields) {
    nextBaseline[field] = latest[field];
    if (choice === 'saved') nextDraft[field] = latest[field];
  }
  return { baseline: nextBaseline as T, draft: nextDraft as T };
}
