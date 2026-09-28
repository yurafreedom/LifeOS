import { LifeDogSeed } from '../../data/dog.js';
import { LifeMeds } from '../../data/medications.js';
import { LifeProfileSeed } from '../../data/profile.js';

/* Seeds and the initial operational snapshot (state.version 2). Pure and
   React-free; LifeDataContext.jsx re-exports buildInitialState. */

function buildDefaultHabits() {
  return [
    { id: 1, titleKey: 'habit_read',     week: [1,1,1,0,1,0,0], streak: 12, best: 28 },
    { id: 2, titleKey: 'habit_no_phone', week: [1,1,0,1,1,0,0], streak: 30, best: 30 },
    { id: 3, titleKey: 'habit_walk',     week: [1,1,1,1,0,0,0], streak: 4,  best: 16 },
    { id: 4, titleKey: 'habit_write',    week: [1,0,1,1,0,0,0], streak: 2,  best: 41 },
  ];
}

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
    projects: [],
    goals: buildDefaultGoals(),
    habits: buildDefaultHabits(),
    quickNotes: [
      { id: 101, text: 'спросить у врача про дозу',                    at: '08:14' },
      { id: 102, text: 'идея: разделить расходы на постоянные/перем.', at: '11:02' },
      { id: 103, text: 'мама — найти билеты на декабрь',               at: '14:48' },
      { id: 104, text: 'послушать тот подкаст про CYP2D6',             at: '17:21' },
    ],
    waitingItems: [],
    references: [],
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

export {
  buildDefaultGoals,
  buildDefaultHabits,
  buildInitialState,
  defaultScheduleTimes,
  isoDaysAgo,
  seedTransactions,
};
