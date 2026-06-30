/* global React */
const { useContext: useCtxHome, useMemo: useMemoHome } = React;

/* HomePage — Sprint 2 stats dashboard.
   Batches:
     1 · header (existing TopBar above) + hero stat row (this batch)
     2 · trend chart + category chart
     3 · upcoming-this-week + recent bot
     4 · design-system cards + verifier
   Sections render unconditionally; each handles its own empty state.

   Stat seeds come from window.LifeDashSeed; navigation requests funnel
   through props.onNav so we don't re-import the route registry here.

   Sprint 3B · flexible finance: budget/category/trend numbers are now
   derived from state.transactions filtered by the per-tx + per-category
   eye toggles. Only the CURRENT month's trend point recomputes —
   prior 5 months stay on seed (we don't carry per-transaction history
   for past months). */
function HomePage({ onNav, onOpenTask, emptyMode }) {
  const { t, locale } = useCtxHome(window.LifeLocaleContext);
  const data = React.useContext(window.LifeDataContext);
  const seed = emptyMode ? {} : (window.LifeDashSeed || {});
  const F = window.LifeFinance;

  /* ── derived finance (Sprint 3B) ────────────────────────────────── */
  const txAll      = (data && data.state && data.state.transactions) || [];
  const overrides  = (data && data.state && data.state.categoryOverrides) || {};
  const txList     = emptyMode ? [] : txAll;
  const inTotals   = F.sumIncluded(txList, overrides);
  const hiddenAmt  = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : (+x.amount || 0)), 0);

  /* ── hero stats — derive presentation values from seed ──────────── */
  const seedBudget = seed.budget || { capUsd: 0, spentUsd: 0 };
  const budget = {
    capUsd:   seedBudget.capUsd,
    spentUsd: emptyMode || txAll.length === 0 ? seedBudget.spentUsd : inTotals,
    capsByCat: seedBudget.capsByCat,
  };
  const budgetPct = budget.capUsd > 0 ? Math.round((budget.spentUsd / budget.capUsd) * 100) : null;
  const budgetWarn = budgetPct != null && budgetPct >= 80 && budgetPct <= 100;
  const budgetOver = budgetPct != null && budgetPct > 100;

  const streak = seed.longestStreak;
  const goal = seed.nearestGoal;
  const tasks = seed.tasksThisWeek || { done: 0, total: 0 };

  const fmt = (n) => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  /* Trend: keep prior months on seed, replace CURRENT (last) month
     with derived sum. When no transactions exist (empty mode or fresh
     v1 snapshot pre-migration) fall back to seed entirely. */
  const trendData = useMemoHome(() => {
    const base = seed.last6Months || [];
    if (emptyMode || txAll.length === 0 || base.length === 0) return base;
    const next = base.slice();
    const last = next[next.length - 1];
    next[next.length - 1] = { ...last, expenses: inTotals };
    return next;
  }, [seed.last6Months, emptyMode, txAll.length, inTotals]);

  /* Category breakdown: rebuild from transactions when we have any,
     otherwise fall back to seed. categoryOverrides drops whole rows. */
  const catBreakdown = useMemoHome(() => {
    if (emptyMode || txAll.length === 0) return seed.categoryBreakdown || [];
    return F.byCategory(txAll, overrides);
  }, [emptyMode, txAll, overrides, seed.categoryBreakdown]);

  const allCatsHidden = !emptyMode && F.allCategoriesHidden(overrides, window.LifeExpenseCats || []);

  const cards = useMemoHome(() => ([
    {
      id: 'budget',
      eyebrow: t('home_card_budget'),
      value:   budget.capUsd > 0 ? `${budgetPct}%` : null,
      valueClass: budgetOver ? 'is-over' : budgetWarn ? 'is-stakes' : '',
      context: hiddenAmt > 0 && !emptyMode
        ? t('home_card_budget_derived', fmt(budget.spentUsd), fmt(hiddenAmt))
        : t('home_card_budget_ctx', fmt(budget.spentUsd), fmt(budget.capUsd)),
      emptyContext: t('home_card_budget_empty'),
      onClick: () => onNav(budget.capUsd > 0 ? 'finances' : 'settings'),
    },
    {
      id: 'streak',
      eyebrow: t('home_card_streak'),
      value:   streak && streak.days > 0 ? streak.days : null,
      context: streak
        ? t('home_card_streak_ctx', t(streak.habitKey), streak.days, t.pl('pl_day', streak.days))
        : '',
      emptyContext: t('home_card_streak_empty'),
      onClick: () => onNav('habits'),
    },
    {
      id: 'goal',
      eyebrow: t('home_card_goal'),
      value:   goal && goal.pct > 0 ? `${goal.pct}%` : null,
      context: goal ? t(goal.titleKey) : '',
      emptyContext: t('home_card_goal_empty'),
      onClick: () => onNav('goals'),
    },
    {
      id: 'tasks',
      eyebrow: t('home_card_tasks'),
      value:   tasks.total > 0 ? `${tasks.done} / ${tasks.total}` : null,
      context: t('home_card_tasks_ctx'),
      emptyContext: t('home_card_tasks_empty'),
      onClick: () => onNav('tasks'),
    },
  ]), [t, locale, budget, budgetPct, budgetWarn, budgetOver, streak, goal, tasks, onNav, hiddenAmt, emptyMode]);

  return (
    <div className="page home-page">

      {/* hero stats — 4 cards */}
      <section className="home-hero">
        {cards.map(c => (
          <window.StatCard key={c.id}
                           eyebrow={c.eyebrow}
                           value={c.value}
                           valueClass={c.valueClass}
                           context={c.context}
                           emptyContext={c.emptyContext}
                           onClick={c.onClick} />
        ))}
      </section>

      {/* charts row — trend (left) + categories (right). 50/50 ≥960px, stacked below. */}
      <section className="home-charts">
        <window.TrendChart
          data={emptyMode ? [] : trendData}
          onNav={onNav} />
        <window.CategoryChart
          monthData={allCatsHidden ? [] : (emptyMode ? [] : catBreakdown)}
          days30Data={emptyMode ? [] : (seed.categoryBreakdown30d || [])}
          capsByCat={(seed.budget && seed.budget.capsByCat) || {}}
          locale={locale}
          allHidden={allCatsHidden}
          allHiddenHint={t('home_cat_all_hidden')}
          onEmptyCta={() => onNav && onNav('finances')} />
      </section>

    </div>
  );
}

window.HomePage = HomePage;
