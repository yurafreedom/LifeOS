import { findTask } from '../domain/tasks.ts';

/* Tasks detail save (GTD G2). A schedule change goes through moveTask — the
   same path as the Calendar editor, so the SAME task moves day (id, order and
   lifecycle kept, legacy `due` label re-derived by semanticDue). Anything else
   is a plain field patch. A task that no longer exists is reported, never
   recreated: `tasks` is the state this click's handler was rendered with,
   which React commits before dispatching the next discrete event, and the
   provider updaters are themselves no-ops for a missing id. */
export function saveTaskDetail({ tasks, data }, id, patch, schedule) {
  if (!findTask(tasks || [], id)) return { ok: false, code: 'missing' };
  if (schedule !== undefined) data.moveTask(id, schedule, patch);
  else if (Object.keys(patch).length > 0) data.updateTaskFields(id, patch);
  return { ok: true };
}
