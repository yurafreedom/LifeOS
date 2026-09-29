/* Task domain — pure helpers over the operational `state.tasks` array.
 *
 * Tasks live in the server snapshot (state version 2). Every helper here takes
 * the task array and returns a NEW array; nothing is mutated in place and
 * nothing is persisted outside `state.tasks`. */

export type TaskSchedule = { date: string; time: string };

export type TaskRecord = {
  id: number | string;
  title?: string;
  titleKey?: string;
  done?: boolean;
  stakes?: boolean;
  due?: string;
  schedule?: TaskSchedule | null;
  notes?: string;
  [key: string]: unknown;
};

type TaskId = TaskRecord['id'];

const sameId = (task: TaskRecord, id: TaskId) => String(task.id) === String(id);

/* Merge a patch of edited fields onto the PERSISTED task with this id. Fields
   the caller did not edit are never touched, so a partial or display-resolved
   object can no longer overwrite notes, category, subtasks or schedule. */
export function patchTask(tasks: TaskRecord[], id: TaskId, patch: Partial<TaskRecord>): TaskRecord[] {
  return tasks.map(task => (sameId(task, id) ? { ...task, ...patch, id: task.id } : task));
}

export function findTask(tasks: TaskRecord[], id: TaskId): TaskRecord | undefined {
  return tasks.find(task => sameId(task, id));
}
