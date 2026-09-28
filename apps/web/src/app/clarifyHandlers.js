/* ── Clarify ───────────────────────────────────────────
   Each handler performs one real domain transition through the provider.
   The provider validates and persists the destination before removing the
   source note, both in a single state update — so a rejection here leaves
   the Quick Note in the inbox and the ClarifyPanel shows the reason. The
   global Quick Add path (addTaskFromUI / QuickAddModal) is untouched. */
function createClarifyHandlers({ data, t, showToast }) {
  function clarifyToast(key, arg) {
    showToast({
      kind: 'sys',
      msg: t(key, arg),
      ts: new Date().toTimeString().slice(0, 5) + ' · ' + t('nav_today'),
    });
  }

  return {
    onDoNow(note) {
      const task = data.clarifyQuickNoteToTask(note.id);
      clarifyToast('clarify_toast_do_now', task.title);
    },
    onDelegate(note) {
      const item = data.clarifyQuickNoteToWaiting(note.id);
      clarifyToast('clarify_toast_delegate', item.title);
    },
    onDefer(note, deferDate) {
      const task = data.clarifyQuickNoteToDeferredTask(note.id, deferDate);
      clarifyToast('clarify_toast_defer', task.schedule.date);
    },
    onProject(note) {
      const project = data.clarifyQuickNoteToProject(note.id);
      clarifyToast('clarify_toast_project', project.title);
    },
    onReference(note) {
      const reference = data.clarifyQuickNoteToReference(note.id);
      clarifyToast('clarify_toast_reference', reference.text);
    },
    onDelete(note) {
      /* Guarded like the other five so a stale panel reports the truth instead
         of claiming a deletion that never applied. */
      data.requireClarifiableQuickNote(note.id);
      data.deleteQuickNote(note.id);
      clarifyToast('clarify_toast_deleted');
    },
  };
}

export { createClarifyHandlers };
