/* data/dashboard-seed.js
 *
 * Mock seed for /home stats dashboard. Numbers are realistic for one
 * person living in a tier-1 city; replace with real aggregates once
 * the data layer lands.
 *
 * Currency is USD across the kit (per money-widget v1 convention). */

window.LifeDashSeed = {
  /* ── headline numbers (current month) ─────────────────────────── */
  budget: {
    capUsd:   4000,
    spentUsd: 2480,
    /* category caps used by the categories chart to decide if any one
       row deserves the orange-stakes treatment. Sum doesn't need to
       equal capUsd — these are soft sub-caps. */
    capsByCat: {
      rent:          1200,
      groceries:      450,
      restaurants:    300,
      subscriptions:  150,
      utilities:      250,
      transport:      180,
      health:         200,
      entertainment:  150,
      care:           120,
      household:      200,
    },
  },

  /* ── trend chart · last 6 months ──────────────────────────────── */
  /* monthKey is a stable id; label is what we render on the X-axis. */
  last6Months: [
    { monthKey: '2026-01', label_ru: 'янв', label_uk: 'січ', expenses: 3120, income: 5200 },
    { monthKey: '2026-02', label_ru: 'фев', label_uk: 'лют', expenses: 2850, income: 5200 },
    { monthKey: '2026-03', label_ru: 'мар', label_uk: 'бер', expenses: 4180, income: 6800 },
    { monthKey: '2026-04', label_ru: 'апр', label_uk: 'кві', expenses: 2920, income: 5200 },
    { monthKey: '2026-05', label_ru: 'май', label_uk: 'тра', expenses: 3650, income: 5500 },
    { monthKey: '2026-06', label_ru: 'июн', label_uk: 'чер', expenses: 2480, income: 5200 },
  ],

  /* ── category breakdown · current month ───────────────────────── */
  /* sums to 2480 (matches budget.spentUsd). Sorted unsorted on purpose
     — the chart sorts descending at render time. */
  categoryBreakdown: [
    { catId: 'rent',          amount: 1100 },
    { catId: 'groceries',     amount:  380 },
    { catId: 'utilities',     amount:  220 },
    { catId: 'restaurants',   amount:  240 },
    { catId: 'subscriptions', amount:  140 },  // 93% of cap 150 → triggers orange stakes
    { catId: 'transport',     amount:   95 },
    { catId: 'health',        amount:  165 },
    { catId: 'entertainment', amount:   85 },
    { catId: 'care',          amount:   55 },
  ],
  /* 30-day variant — used by the "30 дней" filter. Slightly different
     numbers since the window slides over a different range. */
  categoryBreakdown30d: [
    { catId: 'rent',          amount: 1100 },
    { catId: 'groceries',     amount:  410 },
    { catId: 'restaurants',   amount:  285 },
    { catId: 'utilities',     amount:  220 },
    { catId: 'subscriptions', amount:  140 },
    { catId: 'transport',     amount:  118 },
    { catId: 'health',        amount:  165 },
    { catId: 'entertainment', amount:   95 },
    { catId: 'care',          amount:   62 },
    { catId: 'household',     amount:   45 },
  ],

  /* ── streak (hero card 2) ─────────────────────────────────────── */
  longestStreak: {
    days: 47,
    habitKey: 'habit_write',
  },

  /* ── goal (hero card 3) ───────────────────────────────────────── */
  nearestGoal: {
    titleKey: 'goal_emergency',
    pct: 84,
  },

  /* ── tasks this week (hero card 4) ────────────────────────────── */
  tasksThisWeek: {
    done:  23,
    total: 30,
  },
};
