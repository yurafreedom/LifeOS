import { validateReferenceRecord, validateWaitingItemRecord } from '../../domain/clarify.ts';
import { validateProjectRecord } from '../../domain/projects.ts';
import { validateTaskRecord } from '../../domain/tasks.ts';
import { buildDefaultGoals, buildDefaultHabits, seedTransactions } from './initialState.js';

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/* Pure migration/validation boundary. The input may be a server payload or
   the read-only legacy import object; neither is ever mutated in place. */
function migrateStateCopy(input) {
  if (!isPlainObject(input)) throw new Error('State payload must be an object.');
  let state;
  try {
    state = JSON.parse(JSON.stringify(input));
  } catch {
    throw new Error('State payload cannot be cloned.');
  }
  const knownVersionlessV1 = state.version == null
    && Array.isArray(state.tasks)
    && isPlainObject(state.profile);
  if (state.version == null && !knownVersionlessV1) throw new Error('State version is missing.');
  if (state.version != null && (typeof state.version !== 'number' || !Number.isFinite(state.version))) {
    throw new Error('State version is invalid.');
  }
  if (state.version > 2) throw new Error('State version is newer than this app supports.');
  /* Sprint 3B · v1 → v2: seed transactions + categoryOverrides for
     flexible-finance. v1 snapshots had transactions:[] from Sprint 3A
     because no logger surface existed yet — reseed so the demo has
     content on first paint after upgrade. */
  if (knownVersionlessV1 || state.version < 2) {
    if (!Array.isArray(state.transactions) || state.transactions.length === 0) {
      state.transactions = seedTransactions();
    }
    if (state.categoryOverrides == null) state.categoryOverrides = {};
    state.version = 2;
  }
  /* Goals hoisted into persisted state (Batch 1 rev · FIX 7). Older
     snapshots (v1/v2) predate the field — seed the shipped defaults so the
     Goals screen isn't empty after upgrade. Unconditional null-check, runs
     regardless of version gate. */
  if (!Array.isArray(state.goals)) state.goals = buildDefaultGoals();
  if (!Object.prototype.hasOwnProperty.call(state, 'projects')) state.projects = [];
  if (!Array.isArray(state.projects)) throw new Error('State collection projects is invalid.');
  state.projects.forEach(validateProjectRecord);
  /* Clarify · additive operational collections. Snapshots written before the
     Clarify panel existed simply lack them — seed to [] and leave every other
     field untouched. Nothing here bumps the state version. */
  if (!Object.prototype.hasOwnProperty.call(state, 'waitingItems')) state.waitingItems = [];
  if (!Array.isArray(state.waitingItems)) {
    throw new Error('State collection waitingItems is invalid.');
  }
  state.waitingItems.forEach(validateWaitingItemRecord);
  if (!Object.prototype.hasOwnProperty.call(state, 'references')) state.references = [];
  if (!Array.isArray(state.references)) {
    throw new Error('State collection references is invalid.');
  }
  state.references.forEach(validateReferenceRecord);
  if (!Array.isArray(state.habits)) {
    state.habits = buildDefaultHabits();
  } else {
    state.habits = state.habits.map((habit, index) => {
      if (!isPlainObject(habit)) throw new Error('Habit data is invalid.');
      const fallback = buildDefaultHabits()[index];
      const titleKey = typeof habit.titleKey === 'string' ? habit.titleKey : null;
      const name = typeof habit.name === 'string' ? habit.name : null;
      if (!titleKey && !name) throw new Error('Habit title is missing.');
      return {
        ...habit,
        ...(titleKey ? { titleKey } : { name }),
        week: Array.isArray(habit.week) && habit.week.length === 7
          ? habit.week.map(value => value ? 1 : 0)
          : (fallback ? fallback.week.slice() : [0,0,0,0,0,0,0]),
      };
    });
  }
  const arrays = [
    'medications', 'tasks', 'transactions', 'projects', 'goals', 'quickNotes',
    'waitingItems', 'references', 'activityLog',
  ];
  const objects = ['profile', 'dog', 'doseLogs', 'pharmNotes', 'modeStyles', 'categoryOverrides'];
  arrays.forEach(key => {
    if (!Array.isArray(state[key])) throw new Error(`State collection ${key} is invalid.`);
  });
  objects.forEach(key => {
    if (!isPlainObject(state[key])) throw new Error(`State object ${key} is invalid.`);
  });
  /* Calendar · optional task metadata (created_at, completed_at, closure,
     closed_at, order). Additive: absent fields stay absent (no backfill, no
     version bump); a present malformed value is rejected. */
  state.tasks.forEach(validateTaskRecord);
  return state;
}

function buildLegacyPreview(state, raw) {
  return {
    version: state.version,
    size: `${new Blob([raw]).size} B`,
    tasks: state.tasks.length,
    goals: state.goals.length,
    transactions: state.transactions.length,
    projects: state.projects.length,
    medications: state.medications.length,
    notes: state.quickNotes.length,
    activity: state.activityLog.length,
  };
}

export { buildLegacyPreview, isPlainObject, migrateStateCopy };
