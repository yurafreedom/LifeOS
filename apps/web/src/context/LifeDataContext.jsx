import React from 'react';
import { LifeDogSeed } from '../data/dog.js';
import { LifeMeds } from '../data/medications.js';
import { LifeProfileSeed } from '../data/profile.js';
import { LifeActivity } from '../lib/activity.js';
import { LifeStorage } from '../lib/storage.js';

/* global React */
/* LifeDataProvider · central state tree
 *
 * Single React reducer-ish state container holding everything that
 * persists across reloads. Backed by lib/storage.js. Children get
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

/* Build the initial state tree. Called once on mount when no
   localStorage snapshot exists. Falls back to the seed objects we
   ship from data/*. */
function buildInitialState() {
  const meds = (LifeMeds || []).map(m => ({
    ...m,
    image_path:               m.image_path        != null ? m.image_path        : null,
    inventory_count:          m.inventory_count   || 0,
    low_stock_threshold_days: m.low_stock_threshold_days || 7,
    schedule:                 Array.isArray(m.schedule) ? m.schedule : defaultScheduleTimes(m),
    discontinuation_template: m.discontinuation_template || null,
  }));

  /* Seed dose logs — one per active med, ~6-12h ago. Gives the
     three timers something to compute against on first load. QA
     scenario 2 needs this. */
  const doseLogs = {};
  const now = Date.now();
  meds.forEach(m => {
    doseLogs[m.id] = [];
    if (m.status === 'active' && m.dose_interval_h && m.current_dose_mg_per_day) {
      const dosesBack = Math.min(3, m.doses_per_day || 1);
      for (let i = dosesBack; i >= 1; i--) {
        const hoursAgo = (m.dose_interval_h || 24) * i - (Math.random() * 0.3);
        const ts = new Date(now - hoursAgo * 3600000).toISOString();
        const dose = Math.round((m.current_dose_mg_per_day / (m.doses_per_day || 1)) * 10) / 10;
        doseLogs[m.id].unshift({ taken_at: ts, dose_mg: dose, mode: 'scheduled', note: '' });
      }
    }
  });

  /* Seed pharmacist notes for two meds — enough to exercise the
     summary chip and the global journal feed. */
  const pharmNotes = {
    bupropion: [
      { id: 'pn1', date: isoDaysAgo(2), polarity: '+', text: 'энергия в первой половине дня лучше' },
      { id: 'pn2', date: isoDaysAgo(5), polarity: '+', text: 'легче сесть за работу с утра' },
      { id: 'pn3', date: isoDaysAgo(8), polarity: '-', text: 'сухость во рту, особенно утром' },
    ],
    vortioxetine: [
      { id: 'pn4', date: isoDaysAgo(3), polarity: '+', text: 'настроение ровнее на 5 неделю' },
      { id: 'pn5', date: isoDaysAgo(12), polarity: '-', text: 'тошнота в первый час после приёма' },
    ],
  };

  /* Inventory — give a couple meds low counts so the risk-tier
     chips have something to render on first paint. */
  const invSeed = {
    sertraline:   18,
    bupropion:    24,
    vortioxetine: 11,
    duloxetine:    5,    // → yellow "купить скоро"
    milnacipran:   2,    // → orange "купить срочно"
    lamotrigine:  41,
    nac:           1,    // → red "заканчивается"
    magtein:       0,    // → red "закончился"
  };
  meds.forEach(m => { if (invSeed[m.id] != null) m.inventory_count = invSeed[m.id]; });

  return {
    version: 2,
    profile: LifeProfileSeed || {},
    dog:     LifeDogSeed     || {},
    medications: meds,
    doseLogs,
    pharmNotes,
    modeStyles: {},
    tasks: [
      { id: 1, titleKey: 'seed_task_ship',   done: false, stakes: true,  tag: 'today',  due: 'eod' },
      { id: 2, titleKey: 'seed_task_commit', done: false, stakes: true,  tag: 'stakes', due: '17:00' },
      { id: 3, titleKey: 'seed_task_review', done: false, stakes: false, tag: 'work',   due: '14:00' },
      { id: 4, titleKey: 'seed_task_log',    done: true,  stakes: false, tag: 'money',  due: '09:12' },
      { id: 5, titleKey: 'seed_task_read',   done: false, stakes: false, tag: 'habit',  due: '21:00' },
      { id: 6, titleKey: 'seed_task_mum',    done: false, stakes: false, tag: 'life',   due: 'tue' },
    ],
    transactions: seedTransactions(),
    categoryOverrides: {},
    goals: buildDefaultGoals(),
    habits: {},
    quickNotes: [
      { id: 101, text: 'спросить у врача про дозу',                    at: '08:14' },
      { id: 102, text: 'идея: разделить расходы на постоянные/перем.', at: '11:02' },
      { id: 103, text: 'мама — найти билеты на декабрь',               at: '14:48' },
      { id: 104, text: 'послушать тот подкаст про CYP2D6',             at: '17:21' },
    ],
    activityLog: [],
  };
}

function isoDaysAgo(d) {
  return new Date(Date.now() - d * 86400000).toISOString();
}

/* Seed goals. Shipped defaults carry a titleKey/tagKey so they localise
   through i18n; user-added goals (see addGoal) carry a literal `title`
   and `tag`. GoalsWidget renders `title || t(titleKey)`. */
function buildDefaultGoals() {
  return [
    { id: 'g_emergency', titleKey: 'goal_emergency',     pct: 62, val: '$1,550 / $2,500', tagKey: 'goal_tag_q3'  },
    { id: 'g_shipv1',    titleKey: 'goal_ship_v1',       pct: 81, val: '13 / 16',         tagKey: 'goal_tag_q4'  },
    { id: 'g_marathon',  titleKey: 'goal_half_marathon', pct: 34, val: '7 / 20',          tagKey: 'goal_tag_jan' },
  ];
}

/* Sprint 3B · seed transactions for the flexible-finance demo.
   Numbers chosen to mirror dashboard-seed.categoryBreakdown so the
   /home hero, trend chart, and category bars all line up with the
   /finances list when totals are computed from this source.

   One row ships with included_in_totals: false to demonstrate the
   excluded visual + the gap between "$2,480 spent" (seed) and
   "$2,380 in totals" (derived) on first load. */
function seedTransactions() {
  return [
    { id: 't01', amount: 1100, category_id: 'rent',          date: '2026-10-01', description: 'аренда · октябрь',          source: 'monobank', included_in_totals: true },
    { id: 't02', amount: 145,  category_id: 'groceries',     date: '2026-10-03', description: 'сильпо · крупная закупка', source: 'monobank', included_in_totals: true },
    { id: 't03', amount: 95,   category_id: 'groceries',     date: '2026-10-08', description: 'novus · продукты',         source: 'monobank', included_in_totals: true },
    { id: 't04', amount: 140,  category_id: 'groceries',     date: '2026-10-15', description: 'wolt · доставка',          source: 'monobank', included_in_totals: true },
    { id: 't05', amount: 75,   category_id: 'restaurants',   date: '2026-10-04', description: 'kontora · ужин',            source: 'monobank', included_in_totals: true },
    { id: 't06', amount: 42,   category_id: 'restaurants',   date: '2026-10-07', description: 'кафе с другом',            source: 'manual',   included_in_totals: true },
    { id: 't07', amount: 68,   category_id: 'restaurants',   date: '2026-10-12', description: 'sushi · доставка',         source: 'monobank', included_in_totals: true },
    { id: 't08', amount: 55,   category_id: 'restaurants',   date: '2026-10-19', description: 'shokeen · обед',            source: 'monobank', included_in_totals: true },
    { id: 't09', amount: 220,  category_id: 'utilities',     date: '2026-10-05', description: 'свет + газ',                source: 'monobank', included_in_totals: true },
    { id: 't10', amount: 140,  category_id: 'subscriptions', date: '2026-10-02', description: 'софт · подписки',          source: 'monobank', included_in_totals: true },
    { id: 't11', amount: 95,   category_id: 'transport',     date: '2026-10-09', description: 'uber · поездки',            source: 'monobank', included_in_totals: true },
    { id: 't12', amount: 65,   category_id: 'health',        date: '2026-10-11', description: 'аптека',                    source: 'manual',   included_in_totals: true },
    { id: 't13', amount: 100,  category_id: 'health',        date: '2026-10-13', description: 'терапия',                    source: 'manual',   included_in_totals: false },
    { id: 't14', amount: 85,   category_id: 'entertainment', date: '2026-10-14', description: 'кино · 2 билета',           source: 'monobank', included_in_totals: true },
    { id: 't15', amount: 55,   category_id: 'care',          date: '2026-10-17', description: 'парикмахер',                 source: 'manual',   included_in_totals: true },
  ];
}
function defaultScheduleTimes(m) {
  /* Map schedule_default slot names → reasonable clock times.
     User can edit these in the config drawer (Batch 3). */
  const map = { morning: '08:00', midday: '13:00', afternoon: '16:00', evening: '21:00', night: '23:00' };
  return (m.schedule_default || []).map(s => map[s] || '08:00');
}

/* Migration shim for old snapshots. When we bump version, dispatch
   keyed migrations from here. */
function migrate(state) {
  if (!state || typeof state !== 'object') return null;
  /* Sprint 3B · v1 → v2: seed transactions + categoryOverrides for
     flexible-finance. v1 snapshots had transactions:[] from Sprint 3A
     because no logger surface existed yet — reseed so the demo has
     content on first paint after upgrade. */
  if (!state.version || state.version < 2) {
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
  return state;
}

/* ── Provider ─────────────────────────────────────────── */
function LifeDataProvider(props) {
  const [state, setStateRaw] = useStateDP(() => {
    const persisted = migrate(LifeStorage.load());
    return persisted || buildInitialState();
  });

  /* Persist on every change. lib/storage.js throttles writes
     internally, so we can fire on every state diff without
     hammering localStorage. */
  useEffectDP(() => { LifeStorage.save(state); }, [state]);

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
  function addTransaction(tx) {
    const entry = {
      id:        tx.id || ('t' + Date.now()),
      amount:    tx.amount,
      category_id: tx.category_id,
      date:      tx.date || new Date().toISOString().slice(0, 10),
      description: tx.description || '',
      source:    tx.source || 'manual',
      included_in_totals: tx.included_in_totals !== false,
    };
    mutate(prev => ({ transactions: [entry, ...prev.transactions] }), {
      entity_type: 'transaction', entity_id: entry.id, action: 'created',
      details: { amount: entry.amount, category_id: entry.category_id, description: entry.description },
    });
  }
  function toggleTransactionInclusion(transactionId) {
    setStateRaw(prev => {
      const tx = prev.transactions.find(x => x.id === transactionId);
      if (!tx) return prev;
      const nextIncluded = tx.included_in_totals === false ? true : false;
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
  function toggleCategoryInclusion(categoryId) {
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

  /* ── Goals · Batch 1 rev · FIX 7 ──────────────────── */
  /* Minimal add-goal path: a new goal starts at 0% with a default
     timeframe tag (current quarter). Batch 4 (Clarify "project" outcome)
     reuses this same entry point — keep it lean and additive. */
  function addGoal(title) {
    const clean = (title || '').trim();
    if (!clean) return;
    const id = 'g' + Date.now();
    const q  = Math.floor(new Date().getMonth() / 3) + 1;
    const goal = { id, title: clean, pct: 0, val: '', tag: 'Q' + q };
    mutate(prev => ({ goals: [...(prev.goals || []), goal] }),
      { entity_type: 'goal', entity_id: id, action: 'created', details: { title: clean } });
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
  function hardReset() {
    LifeStorage.clear();
    setStateRaw(buildInitialState());
  }

  const value = useMemoDP(() => ({
    state,
    /* tasks */ toggleTask, addTask, updateTask, deleteTask,
    /* transactions */ addTransaction, toggleTransactionInclusion, toggleCategoryInclusion,
    /* goals */ addGoal,
    /* notes */ addQuickNote, deleteQuickNote,
    /* profile + dog */ updateProfile, updateDog,
    /* meds */ updateMedication, deleteMedication, setMedicationStatus,
              setMedicationInventory, takeDose, snoozeDose, skipDose,
    /* modes */ setModeStyle,
    /* pharm notes */ addPharmNote, editPharmNote, deletePharmNote,
    /* maint */ clearActivityOlderThan, exportJSON, hardReset,
  }), [state]);

  return React.createElement(LifeDataContext.Provider, { value }, props.children);
}

export { LifeDataContext, LifeDataProvider };
