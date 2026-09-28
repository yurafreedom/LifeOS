import React from 'react';
import { LifeActivity } from '../lib/activity.js';
import {
  applyClarifyTransition,
  createClarifiedTaskRecord,
  createDeferredTaskRecord,
  createReferenceRecord,
  createWaitingItemRecord,
  requireQuickNote,
} from '../domain/clarify.ts';
import {
  archiveProjectRecord,
  completeProjectWithDurableIntent,
  createProjectRecord,
  setProjectForecastWithDurableIntent,
} from '../domain/projects.ts';
import { ApiError } from '../api/client.ts';
import { StateImportPrompt } from '../components/StateImportPrompt.jsx';
import { readLegacyLocalState, recordLegacyDecision } from '../repositories/legacyLocalImport.ts';
import { ServerStateRepository } from '../repositories/serverStateRepository.ts';
import { StateSyncCoordinator } from '../repositories/stateSyncCoordinator.ts';
import { LifeLocaleContext } from './LocaleContext.jsx';
import { AnalyticsContext } from './AnalyticsContext.jsx';
import { buildInitialState } from './lifeData/initialState.js';
import { buildLegacyPreview, migrateStateCopy } from './lifeData/migrate.js';

/* global React */
/* LifeDataProvider · central state tree
 *
 * Single React reducer-ish state container holding everything that
 * persists across reloads. Backed by the authenticated server snapshot. Children get
 * read/write access via LifeDataContext.
 *
 * Sprint 3A goal: hoist tasks / profile / dog / quickNotes out of
 * App.jsx scattered useState calls into one tree, plus add new
 * persisted fields (medications, doseLogs, pharmNotes, modeStyles,
 * activityLog). The dispatcher functions exposed here are the only
 * legal way to mutate persisted state — every mutation appends to
 * activityLog in the same setState pass.
 *
 * Keep this file as a thin orchestrator. Heavy mutation logic that
 * needs unit-testable purity should live in lib/. */

const { useState: useStateDP, useEffect: useEffectDP, useMemo: useMemoDP, useRef: useRefDP } = React;

const LifeDataContext = React.createContext(null);
const initialStateRequests = new Map();

/* ── Provider ─────────────────────────────────────────── */
function LifeDataProvider({ user, onSessionExpired, onLogout, children }) {
  const { t } = React.useContext(LifeLocaleContext);
  const analytics = React.useContext(AnalyticsContext);
  const [state, setStateRaw] = useStateDP(null);
  const [boot, setBoot] = useStateDP({ phase: 'loading', error: null, legacy: null, preview: null, raw: null });
  const [sync, setSync] = useStateDP({ phase: 'saved', error: null, currentRevision: null, hasPending: false });
  const [loadGeneration, setLoadGeneration] = useStateDP(0);
  const repositoryRef = useRefDP(null);
  const coordinatorRef = useRefDP(null);
  const acknowledgedStateRef = useRefDP(null);

  if (!repositoryRef.current) repositoryRef.current = new ServerStateRepository();

  function attachAcknowledged(envelope, active) {
    const migrated = migrateStateCopy(envelope.payload);
    if (!active()) return;
    acknowledgedStateRef.current = migrated;
    setStateRaw(migrated);
    coordinatorRef.current?.dispose();
    coordinatorRef.current = new StateSyncCoordinator({
      repository: repositoryRef.current,
      initialRevision: envelope.revision,
      onStatus: setSync,
      onSessionExpired,
    });
    setBoot({ phase: 'ready', error: null, legacy: null, preview: null, raw: null });
  }

  useEffectDP(() => {
    let alive = true;
    const controller = new window.AbortController();
    const isActive = () => alive;
    setStateRaw(null);
    setBoot({ phase: 'loading', error: null, legacy: null, preview: null, raw: null });
    setSync({ phase: 'saved', error: null, currentRevision: null, hasPending: false });
    coordinatorRef.current?.dispose();
    coordinatorRef.current = null;

    repositoryRef.current.load(controller.signal)
      .then(async envelope => {
        if (!alive) return;
        if (envelope) {
          try {
            attachAcknowledged(envelope, isActive);
          } catch (error) {
            setBoot({ phase: 'error', error, legacy: null, preview: null, raw: envelope.payload });
          }
          return;
        }
        const legacy = readLegacyLocalState();
        if (legacy.kind === 'absent') {
          let request = initialStateRequests.get(user.id);
          if (!request) {
            const fresh = migrateStateCopy(buildInitialState());
            request = repositoryRef.current.replace(fresh, 0)
              .finally(() => initialStateRequests.delete(user.id));
            initialStateRequests.set(user.id, request);
          }
          const created = await request;
          attachAcknowledged(created, isActive);
          return;
        }
        let nextLegacy = legacy;
        let preview = null;
        if (legacy.kind === 'valid') {
          try {
            const migrated = migrateStateCopy(legacy.payload);
            preview = buildLegacyPreview(migrated, legacy.raw);
          } catch (error) {
            nextLegacy = { kind: 'invalid', raw: legacy.raw, reason: error.message };
          }
        }
        if (alive) setBoot({ phase: 'import', error: null, legacy: nextLegacy, preview, raw: null });
      })
      .catch(error => {
        if (!alive || error?.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else setBoot({ phase: 'error', error, legacy: null, preview: null, raw: null });
      });

    return () => {
      alive = false;
      controller.abort();
      coordinatorRef.current?.dispose();
      coordinatorRef.current = null;
    };
  }, [user.id, loadGeneration]);

  useEffectDP(() => {
    if (!state || boot.phase !== 'ready' || !coordinatorRef.current) return;
    if (state === acknowledgedStateRef.current) return;
    coordinatorRef.current.enqueue(state);
  }, [state, boot.phase]);

  useEffectDP(() => {
    function beforeUnload(event) {
      if (sync.phase === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [sync.phase]);

  async function initializeFromChoice(decision) {
    if (!boot.legacy || boot.phase !== 'import') return;
    setBoot(prev => ({ ...prev, phase: 'initializing', error: null }));
    try {
      const payload = decision === 'imported'
        ? migrateStateCopy(boot.legacy.payload)
        : migrateStateCopy(buildInitialState());
      const envelope = await repositoryRef.current.replace(payload, 0);
      recordLegacyDecision(user.id, decision, envelope.revision);
      attachAcknowledged(envelope, () => true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setBoot(prev => ({ ...prev, phase: 'import', error }));
    }
  }

  /* setState + activity append in a single transaction. updater is
     `(prev) => nextPartial` returning JUST the fields to merge;
     logEntry is appended to activityLog atomically. Pass logEntry
     = null to skip the log (rare — only for ephemeral toggles). */
  function mutate(updater, logEntry) {
    setStateRaw(prev => {
      const patch = typeof updater === 'function' ? updater(prev) : updater;
      const next = { ...prev, ...(patch || {}) };
      if (logEntry) {
        next.activityLog = LifeActivity.append(next.activityLog, logEntry);
      }
      return next;
    });
  }

  /* ── Tasks ────────────────────────────────────────── */
  function toggleTask(id) {
    /* Single-pass mutation. We read the task off the *previous* tree
       inside the updater (NOT the stale `state` closure), flip its
       done flag, and emit the right action label in the same tx. */
    setStateRaw(prev => {
      const tasks = prev.tasks.map(x => x.id === id ? { ...x, done: !x.done } : x);
      const before = prev.tasks.find(x => x.id === id);
      const log = before ? {
        entity_type: 'task', entity_id: id,
        action: before.done ? 'reopened' : 'completed',
        details: { title: before.title || before.titleKey },
      } : null;
      const next = { ...prev, tasks };
      if (log) next.activityLog = LifeActivity.append(next.activityLog, log);
      return next;
    });
  }
  function addTask(task) {
    mutate(prev => ({ tasks: [...prev.tasks, task] }),
      { entity_type: 'task', entity_id: task.id, action: 'created',
        details: { title: task.title, stakes: !!task.stakes } });
  }
  function updateTask(task) {
    mutate(prev => ({ tasks: prev.tasks.map(x => x.id === task.id ? { ...x, ...task } : x) }),
      { entity_type: 'task', entity_id: task.id, action: 'edited',
        details: { title: task.title } });
  }
  function deleteTask(id) {
    setStateRaw(prev => {
      const old = prev.tasks.find(x => x.id === id);
      const tasks = prev.tasks.filter(x => x.id !== id);
      const log = {
        entity_type: 'task', entity_id: id, action: 'deleted',
        details: { title: old && (old.title || old.titleKey) },
      };
      return { ...prev, tasks, activityLog: LifeActivity.append(prev.activityLog, log) };
    });
  }

  /* ── Transactions · Sprint 3B ─────────────────────── */
  /* Flexible-finance toggles. A transaction counts toward totals only
     when its own flag is on AND its category isn't blanket-excluded.
     Both gates persisted; both append to activityLog. */
  async function addTransaction(tx) {
    const entry = {
      id:        tx.id || ('t' + Date.now()),
      amount:    tx.amount,
      category_id: tx.category_id,
      date:      tx.date || new Date().toISOString().slice(0, 10),
      description: tx.description || '',
      source:    tx.source || 'manual',
      included_in_totals: tx.included_in_totals !== false,
    };
    const categorySetting = state?.categoryOverrides?.[entry.category_id];
    const categoryIncluded = categorySetting?.included_in_totals !== false;
    const queued = await analytics?.enqueueTransaction(entry, categoryIncluded);
    if (queued) entry.aa_idempotency_key = queued.idempotency_key;
    mutate(prev => ({ transactions: [entry, ...prev.transactions] }), {
      entity_type: 'transaction', entity_id: entry.id, action: 'created',
      details: { amount: entry.amount, category_id: entry.category_id, description: entry.description },
    });
    return entry;
  }
  async function updateTransaction(transactionId, patch, reason = 'Операция изменена') {
    const current = state?.transactions?.find(x => x.id === transactionId);
    if (!current) return null;
    const next = { ...current, ...patch };
    const measurementKey = current.aa_idempotency_key || `legacy-transaction:${current.id}`;
    const queued = await analytics?.enqueueCorrection(next, measurementKey, reason);
    if (queued) next.aa_idempotency_key = queued.idempotency_key;
    setStateRaw(prev => {
      const transactions = prev.transactions.map(x => x.id === transactionId ? next : x);
      const log = {
        entity_type: 'transaction', entity_id: transactionId, action: 'corrected',
        details: { amount: next.amount, category_id: next.category_id, description: next.description },
      };
      return { ...prev, transactions, activityLog: LifeActivity.append(prev.activityLog, log) };
    });
    return next;
  }
  function correctTransaction(transactionId, patch, reason) {
    return updateTransaction(transactionId, patch, reason || 'Исправление операции');
  }
  async function toggleTransactionInclusion(transactionId) {
    const tx = state?.transactions?.find(x => x.id === transactionId);
    if (!tx) return;
    const nextIncluded = tx.included_in_totals === false;
    const measurementKey = tx.aa_idempotency_key || `legacy-transaction:${tx.id}`;
    await analytics?.enqueueMembership(measurementKey, nextIncluded);
    setStateRaw(prev => {
      const transactions = prev.transactions.map(x =>
        x.id === transactionId ? { ...x, included_in_totals: nextIncluded } : x
      );
      const log = {
        entity_type: 'transaction', entity_id: transactionId,
        action: nextIncluded ? 'included' : 'excluded',
        details: { amount: tx.amount, category_id: tx.category_id, description: tx.description },
      };
      return { ...prev, transactions, activityLog: LifeActivity.append(prev.activityLog, log) };
    });
  }
  async function toggleCategoryInclusion(categoryId) {
    const currentSetting = state?.categoryOverrides?.[categoryId];
    const currentlyIncluded = !currentSetting || currentSetting.included_in_totals !== false;
    const nextIncluded = !currentlyIncluded;
    const futureOverrides = {
      ...(state?.categoryOverrides || {}),
      [categoryId]: { ...(currentSetting || {}), included_in_totals: nextIncluded },
    };
    const excluded = Object.entries(futureOverrides)
      .filter(([, setting]) => setting?.included_in_totals === false)
      .map(([id]) => id);
    await analytics?.enqueuePolicy(excluded);
    setStateRaw(prev => {
      const cur = prev.categoryOverrides[categoryId];
      const currentlyIncluded = !cur || cur.included_in_totals !== false;
      const nextIncluded = !currentlyIncluded;
      const categoryOverrides = {
        ...prev.categoryOverrides,
        [categoryId]: { ...(cur || {}), included_in_totals: nextIncluded },
      };
      const log = {
        entity_type: 'category', entity_id: categoryId,
        action: nextIncluded ? 'included' : 'excluded',
        details: { category_id: categoryId },
      };
      return { ...prev, categoryOverrides, activityLog: LifeActivity.append(prev.activityLog, log) };
    });
  }

  /* ── Projects · Slice P ─────────────────────────────── */
  function addProject(title) {
    const project = createProjectRecord(title);
    mutate(prev => ({ projects: [...prev.projects, project] }), {
      entity_type: 'project', entity_id: project.id, action: 'created',
      details: { title: project.title },
    });
    return project;
  }

  async function setProjectForecast(projectId, forecastDate) {
    const project = state?.projects?.find(item => item.id === projectId);
    if (!project) throw new Error('Project was not found.');
    const next = await setProjectForecastWithDurableIntent(
      project,
      forecastDate,
      async (current, date) => analytics?.enqueueProjectForecast?.(current, date) ?? null,
    );
    mutate(prev => ({
      projects: prev.projects.map(item => item.id === projectId ? next : item),
    }), {
      entity_type: 'project', entity_id: projectId, action: 'forecast_revised',
      details: { title: project.title, forecast_date: forecastDate },
    });
    return next;
  }

  async function completeProject(projectId) {
    const project = state?.projects?.find(item => item.id === projectId);
    if (!project) throw new Error('Project was not found.');
    const completedAt = new Date().toISOString();
    const next = await completeProjectWithDurableIntent(
      project,
      completedAt,
      async (current, instant) => analytics?.enqueueProjectCompletion?.(current, instant) ?? null,
    );
    mutate(prev => ({
      projects: prev.projects.map(item => item.id === projectId ? next : item),
    }), {
      entity_type: 'project', entity_id: projectId, action: 'completed',
      details: { title: project.title, completed_at: completedAt },
    });
    return next;
  }

  function archiveProject(projectId) {
    const project = state?.projects?.find(item => item.id === projectId);
    if (!project) throw new Error('Project was not found.');
    const next = archiveProjectRecord(project);
    mutate(prev => ({
      projects: prev.projects.map(item => item.id === projectId ? next : item),
    }), {
      entity_type: 'project', entity_id: projectId, action: 'archived',
      details: { title: project.title },
    });
    return next;
  }

  /* ── Goals · Batch 1 rev · FIX 7 ──────────────────── */
  /* Minimal add-goal path: a new goal starts at 0% with a default
     timeframe tag (current quarter). Goals remain a separate domain.
     Clarify's future "project" outcome must use the real Project domain
     introduced by Slice P, not addGoal. */
  function addGoal(title) {
    const clean = (title || '').trim();
    if (!clean) return;
    const id = 'g' + Date.now();
    const q  = Math.floor(new Date().getMonth() / 3) + 1;
    const goal = { id, title: clean, pct: 0, val: '', tag: 'Q' + q };
    mutate(prev => ({ goals: [...(prev.goals || []), goal] }),
      { entity_type: 'goal', entity_id: id, action: 'created', details: { title: clean } });
  }

  function toggleHabitToday(habitId, todayIndex) {
    mutate(prev => ({
      habits: (prev.habits || []).map(habit => {
        if (habit.id !== habitId) return habit;
        const week = habit.week.slice();
        week[todayIndex] = week[todayIndex] ? 0 : 1;
        return { ...habit, week };
      }),
    }), null);
  }

  /* ── Quick notes ───────────────────────── */
  function addQuickNote(text) {
    const at = new Date().toTimeString().slice(0, 5);
    const id = Date.now();
    mutate(prev => ({ quickNotes: [{ id, text, at }, ...prev.quickNotes] }),
      { entity_type: 'quick_note', entity_id: id, action: 'created', details: { text } });
  }
  function deleteQuickNote(id) {
    mutate(prev => ({ quickNotes: prev.quickNotes.filter(n => n.id !== id) }),
      { entity_type: 'quick_note', entity_id: id, action: 'deleted' });
  }

  /* ── Clarify · Quick Note → real operational outcome ─ */
  /* Every non-delete outcome follows the same contract:
       1. resolve the source note off the current tree — a stale id raises
          here, before anything is written;
       2. build and validate the destination record;
       3. apply destination creation + source removal in ONE state update.
     So a cancelled or failed Clarify always leaves the Quick Note intact, and
     the note disappears only once its destination is actually persisted.
     Delete keeps using the existing deleteQuickNote path, so it calls
     requireClarifiableQuickNote first to get the same stale-source guard. */
  function requireClarifiableQuickNote(noteId) {
    return requireQuickNote(state, noteId);
  }

  function clarifyQuickNoteToTask(noteId) {
    const note = requireQuickNote(state, noteId);
    const task = createClarifiedTaskRecord(note.text);
    setStateRaw(prev => applyClarifyTransition(prev, noteId, 'do_now', task));
    return task;
  }

  function clarifyQuickNoteToDeferredTask(noteId, deferDate) {
    const note = requireQuickNote(state, noteId);
    const task = createDeferredTaskRecord(note.text, deferDate);
    setStateRaw(prev => applyClarifyTransition(prev, noteId, 'defer', task));
    return task;
  }

  function clarifyQuickNoteToWaiting(noteId, waitingFor = null) {
    const note = requireQuickNote(state, noteId);
    const item = createWaitingItemRecord(note.text, waitingFor);
    setStateRaw(prev => applyClarifyTransition(prev, noteId, 'delegate', item));
    return item;
  }

  /* Project outcome uses the REAL Project domain from Slice P. Never goals[]. */
  function clarifyQuickNoteToProject(noteId) {
    const note = requireQuickNote(state, noteId);
    const project = createProjectRecord(note.text);
    setStateRaw(prev => applyClarifyTransition(prev, noteId, 'project', project));
    return project;
  }

  function clarifyQuickNoteToReference(noteId) {
    const note = requireQuickNote(state, noteId);
    const reference = createReferenceRecord(note.text);
    setStateRaw(prev => applyClarifyTransition(prev, noteId, 'reference', reference));
    return reference;
  }

  /* ── Profile ──────────────────────────────────────── */
  function updateProfile(slice, patch) {
    mutate(prev => ({ profile: { ...prev.profile, [slice]: { ...prev.profile[slice], ...patch } } }),
      { entity_type: 'profile', entity_id: slice, action: 'edited', details: { fields: Object.keys(patch) } });
  }

  /* ── Dog ──────────────────────────────────────────── */
  function updateDog(slice, patch) {
    mutate(prev => ({ dog: { ...prev.dog, [slice]: { ...prev.dog[slice], ...patch } } }),
      { entity_type: 'profile', entity_id: 'dog.' + slice, action: 'edited', details: { fields: Object.keys(patch) } });
  }

  /* ── Medications ──────────────────────────────────── */
  function updateMedication(medId, patch) {
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? { ...m, ...patch } : m),
    }), {
      entity_type: 'med_config', entity_id: medId, action: 'edited',
      details: { fields: Object.keys(patch) },
    });
  }
  function deleteMedication(medId) {
    /* soft delete → archived status, retain dose logs */
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? { ...m, status: 'archived' } : m),
    }), { entity_type: 'med_config', entity_id: medId, action: 'deleted' });
  }
  function setMedicationStatus(medId, status) {
    updateMedication(medId, { status });
  }
  function setMedicationInventory(medId, count) {
    mutate(prev => ({
      medications: prev.medications.map(m => m.id === medId ? { ...m, inventory_count: count } : m),
    }), { entity_type: 'med_config', entity_id: medId, action: 'inventory_updated', details: { count } });
  }

  /* Dose actions */
  function takeDose(medId, payload) {
    const entry = {
      taken_at: payload.taken_at || new Date().toISOString(),
      dose_mg:  payload.dose_mg != null ? payload.dose_mg : null,
      mode:     payload.mode    || 'scheduled',
      note:     payload.note    || '',
    };
    mutate(prev => {
      const list = (prev.doseLogs[medId] || []).slice();
      list.unshift(entry);
      const meds = prev.medications.map(m => {
        if (m.id !== medId) return m;
        const inv = Math.max(0, (m.inventory_count || 0) - 1);
        return { ...m, inventory_count: inv };
      });
      return {
        doseLogs: { ...prev.doseLogs, [medId]: list },
        medications: meds,
      };
    }, {
      entity_type: 'med_dose', entity_id: medId, action: 'dose_taken',
      details: { dose_mg: entry.dose_mg, taken_at: entry.taken_at, note: entry.note },
    });
  }
  function snoozeDose(medId, byHours) {
    mutate(prev => prev, {
      entity_type: 'med_dose', entity_id: medId, action: 'dose_snoozed',
      details: { by_hours: byHours || 1 },
    });
  }
  function skipDose(medId) {
    mutate(prev => prev, {
      entity_type: 'med_dose', entity_id: medId, action: 'dose_skipped',
      details: { skipped_at: new Date().toISOString() },
    });
  }

  /* Mode style */
  function setModeStyle(medId, modeStyle) {
    mutate(prev => ({
      modeStyles: { ...prev.modeStyles, [medId]: { ...modeStyle, startedAt: modeStyle.startedAt || new Date().toISOString() } },
    }), {
      entity_type: 'mode_style', entity_id: medId, action: 'mode_changed',
      details: { type: modeStyle.type, target: modeStyle.target },
    });
  }

  /* Pharm notes */
  function addPharmNote(medId, note) {
    const id = 'pn' + Date.now();
    const entry = {
      id,
      date: note.date || new Date().toISOString().slice(0, 10),
      polarity: note.polarity || '+',
      text: note.text || '',
    };
    mutate(prev => ({
      pharmNotes: { ...prev.pharmNotes, [medId]: [entry, ...(prev.pharmNotes[medId] || [])] },
    }), { entity_type: 'note', entity_id: medId + '/' + id, action: 'note_added', details: { polarity: entry.polarity, text: entry.text } });
  }
  function editPharmNote(medId, noteId, patch) {
    mutate(prev => ({
      pharmNotes: {
        ...prev.pharmNotes,
        [medId]: (prev.pharmNotes[medId] || []).map(n => n.id === noteId ? { ...n, ...patch } : n),
      },
    }), { entity_type: 'note', entity_id: medId + '/' + noteId, action: 'note_edited' });
  }
  function deletePharmNote(medId, noteId) {
    mutate(prev => ({
      pharmNotes: {
        ...prev.pharmNotes,
        [medId]: (prev.pharmNotes[medId] || []).filter(n => n.id !== noteId),
      },
    }), { entity_type: 'note', entity_id: medId + '/' + noteId, action: 'note_deleted' });
  }

  /* ── Maintenance ──────────────────────────────────── */
  function clearActivityOlderThan(cutoffISO) {
    mutate(prev => ({
      activityLog: LifeActivity.pruneOlderThan(prev.activityLog, cutoffISO),
    }), null);
  }
  function exportJSON() {
    /* Snapshot the most recent state via the setter trick — closures
       might otherwise hand us the value at last render. */
    let snap = null;
    setStateRaw(s => { snap = s; return s; });
    return JSON.stringify(snap || state, null, 2);
  }
  function downloadState(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportUnsaved() {
    const payload = coordinatorRef.current?.getPendingPayload() || state;
    if (payload) downloadState(payload, 'lifeOsState-unsaved.json');
  }
  async function retrySync() {
    await coordinatorRef.current?.retry();
  }
  async function reloadServerState() {
    setBoot(prev => ({ ...prev, error: null }));
    try {
      const envelope = await repositoryRef.current.load();
      if (!envelope) throw new Error('Server state is not initialized.');
      const migrated = migrateStateCopy(envelope.payload);
      acknowledgedStateRef.current = migrated;
      setStateRaw(migrated);
      coordinatorRef.current?.resetRevision(envelope.revision);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setSync(prev => ({ ...prev, phase: 'error', error }));
    }
  }
  async function hardReset() {
    if (!coordinatorRef.current || sync.phase === 'conflict') {
      throw new Error('State cannot be reset while synchronization is unresolved.');
    }
    const fresh = migrateStateCopy(buildInitialState());
    const envelope = await coordinatorRef.current.replaceNow(fresh);
    acknowledgedStateRef.current = fresh;
    setStateRaw(fresh);
    return envelope;
  }

  const value = useMemoDP(() => ({
    state,
    /* tasks */ toggleTask, addTask, updateTask, deleteTask,
    /* transactions */ addTransaction, updateTransaction, correctTransaction,
                       toggleTransactionInclusion, toggleCategoryInclusion,
    /* projects */ addProject, setProjectForecast, completeProject, archiveProject,
    /* goals + habits */ addGoal, toggleHabitToday,
    /* notes */ addQuickNote, deleteQuickNote,
    /* clarify */ requireClarifiableQuickNote,
                  clarifyQuickNoteToTask, clarifyQuickNoteToDeferredTask,
                  clarifyQuickNoteToWaiting, clarifyQuickNoteToProject,
                  clarifyQuickNoteToReference,
    /* profile + dog */ updateProfile, updateDog,
    /* meds */ updateMedication, deleteMedication, setMedicationStatus,
              setMedicationInventory, takeDose, snoozeDose, skipDose,
    /* modes */ setModeStyle,
    /* pharm notes */ addPharmNote, editPharmNote, deletePharmNote,
    /* maint */ clearActivityOlderThan, exportJSON, exportUnsaved, hardReset,
    /* sync */ syncPhase: sync.phase, syncError: sync.error, retrySync, reloadServerState,
  }), [state, sync]);

  if (boot.phase === 'loading' || boot.phase === 'initializing') {
    return <main className="auth-screen"><div className="boot-status mono">{t('boot_loading')}</div></main>;
  }
  if (boot.phase === 'import') {
    return <StateImportPrompt
      legacy={boot.legacy}
      preview={boot.preview}
      error={boot.error}
      busy={false}
      onImport={() => initializeFromChoice('imported')}
      onFresh={() => initializeFromChoice('fresh')} />;
  }
  if (boot.phase === 'error' || !state) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>{t('boot_state_title')}</h1>
          <p className="auth-copy">{String(boot.error?.message || t('boot_state_copy'))}</p>
          <div className="import-actions">
            <button className="auth-submit" onClick={() => setLoadGeneration(value => value + 1)}>{t('boot_retry')}</button>
            {boot.raw && <button className="set-btn-ghost" onClick={() => downloadState(boot.raw, 'lifeOsState-server-raw.json')}>{t('boot_export_raw')}</button>}
            <button className="set-btn-ghost" onClick={onLogout}>{t('auth_logout')}</button>
          </div>
        </section>
      </main>
    );
  }

  return React.createElement(LifeDataContext.Provider, { value }, children);
}

export { LifeDataContext, LifeDataProvider, buildInitialState, migrateStateCopy };
