import React from 'react';
import AASignalCard from '../components/analytics/AASignalCard.jsx';
import { AnalyticsContext } from '../context/AnalyticsContext.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { LifeExpenseCats } from '../data/categories.js';
import { todayDateOnly } from '../domain/calendarModel.ts';
import { LifeFinance } from '../lib/finance.js';
import { CategoryChart } from './home/CategoryChart.jsx';
import { StatCard } from './home/StatCard.jsx';
import { TrendChart } from './home/TrendChart.jsx';

/* global React */
const { useContext: useCtxHome, useMemo: useMemoHome } = React;

/* ── системные сигналы ─────────────────────────────────────────────
   A secondary observational layer, and deliberately not an alert centre: it
   sits BELOW the first ordinary panel row (accepted Home decision), shows at
   most three cards ranked by materiality, and never grows a badge, a counter or
   a "see all" list.

   The zero state is a first-class state and a truthful one. No active cards over
   data whose completeness nobody vouched for reads «полнота данных не
   подтверждена», not «всё в порядке» — reassurance the evidence cannot support
   would be a comfortable lie. */
const SIGNAL_ROUTE = { finance: 'finances', project: 'projects' };

const ZERO_COPY = {
  confident: 'aa_sig_zero_confident',
  unknown_coverage: 'aa_sig_zero_unknown',
  no_data: 'aa_sig_zero_no_data',
};

function HomeSignals({ analytics, projects, onNav, t }) {
  const report = analytics && analytics.signals ? analytics.signals.data : null;
  const dismissing = analytics && analytics.signals ? analytics.signals.dismissing : null;
  const failed = analytics && analytics.signals ? analytics.signals.error : null;
  const cards = (report && report.signals) || [];
  const zero = (report && report.zero_state) || 'no_data';

  /* A project's name lives in the snapshot the client already holds; AA stores
     the subject reference, never a copy of the title. */
  const titleFor = (signal) => {
    if (signal.subject_domain !== 'project') return null;
    const match = (projects || []).find(p => String(p.id) === String(signal.subject_id));
    return match ? (match.title || null) : null;
  };

  const open = (signal) => {
    const route = SIGNAL_ROUTE[signal.subject_domain];
    if (route && onNav) onNav(route);
  };

  const dismiss = (signal) => {
    if (!analytics || !analytics.acknowledgeSignal) return;
    analytics.acknowledgeSignal(signal.episode_key, signal.input_fingerprint).catch(() => {});
  };

  return (
    <section className="aa-section home-signals" aria-labelledby="home-signals-head">
      <div className="aa-section-head">
        <h2 className="aa-eyebrow" id="home-signals-head">{t('aa_sig_section')}</h2>
      </div>
      {cards.length === 0
        ? <p className="aa-none">{t(ZERO_COPY[zero] || ZERO_COPY.no_data)}</p>
        : (
          <div className="aa-col">
            {cards.map(signal => (
              <AASignalCard
                key={signal.episode_key}
                signal={signal}
                subjectTitle={titleFor(signal)}
                busy={dismissing === signal.episode_key}
                onOpen={open}
                onDismiss={dismiss} />
            ))}
          </div>
        )}
      {failed ? <p className="aa-none" role="status">{t('aa_sig_dismiss_failed')}</p> : null}
    </section>
  );
}

/* HomePage — Sprint 2 stats dashboard.
   Batches:
     1 · header (existing TopBar above) + hero stat row (this batch)
     2 · trend chart + category chart
     3 · upcoming-this-week + recent bot
     4 · design-system cards + verifier
   Sections render unconditionally; each handles its own empty state.

   Navigation requests funnel through props.onNav so we don't re-import
   the route registry here.

   JENKIN S1 · honest production state: every number on this page comes
   from the account's own snapshot or is an explicit empty state. The old
   dashboard seed (a $4,000 budget, a 47-day streak, an 84% goal, 23/30
   tasks, six months of invented income/expense history, per-category caps)
   is gone: no budget is configured anywhere, and income is not recorded,
   so the 6-month trend shows its empty state rather than half-real data.
   Category totals are derived from state.transactions with the per-tx and
   per-category eye toggles (Sprint 3B). */
/* ── honest derived stats (JENKIN S1) ───────────────────────────── */
function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The habit with the longest current streak the user recorded, or null. */
function longestStreak(habits) {
  let best = null;
  for (const habit of habits || []) {
    const days = Number(habit && habit.streak);
    if (!Number.isFinite(days) || days <= 0) continue;
    if (!best || days > best.days) best = { days, habitKey: habit.titleKey || null, name: habit.name || habit.title || null };
  }
  return best;
}

/** The open goal closest to completion, or null. */
function nearestGoal(goals) {
  let best = null;
  for (const goal of goals || []) {
    const pct = Number(goal && goal.pct);
    if (!Number.isFinite(pct) || pct >= 100) continue;
    if (!best || pct > best.pct) best = { pct, titleKey: goal.titleKey || null, title: goal.title || null };
  }
  return best;
}

/** Tasks dated in the current Monday–Sunday week (Kyiv day): done / total. */
function tasksThisWeek(tasks, today) {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const from = shiftDate(today, -weekday);
  const to = shiftDate(from, 6);
  let done = 0;
  let total = 0;
  for (const task of tasks || []) {
    const date = task && task.schedule && task.schedule.date;
    if (!date || date < from || date > to || task.closure) continue;
    total += 1;
    if (task.done) done += 1;
  }
  return { done, total };
}

function HomePage({ onNav, onOpenTask, emptyMode }) {
  const { t, locale } = useCtxHome(LifeLocaleContext);
  const data = React.useContext(LifeDataContext);
  /* Absent outside the provider (and in tests that render Home alone), so every
     read below is guarded rather than assumed. */
  const analytics = useCtxHome(AnalyticsContext);
  const signalsReady = !!(analytics && analytics.enabled && analytics.ready);

  React.useEffect(() => {
    if (!signalsReady || emptyMode) return undefined;
    const controller = new window.AbortController();
    analytics.loadSignals(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [signalsReady, emptyMode]);
  const F = LifeFinance;

  /* ── derived finance (Sprint 3B) ────────────────────────────────── */
  const txAll      = (data && data.state && data.state.transactions) || [];
  const overrides  = (data && data.state && data.state.categoryOverrides) || {};
  const txList     = emptyMode ? [] : txAll;
  const inTotals   = F.sumIncluded(txList, overrides);
  const hiddenAmt  = txList.reduce((s, x) => s + (F.isIncluded(x, overrides) ? 0 : (+x.amount || 0)), 0);

  /* No budget cap exists in the product yet: the card says so. */
  const budget = { capUsd: 0, spentUsd: inTotals };
  const budgetPct = null;
  const budgetWarn = false;
  const budgetOver = false;

  const habits = emptyMode ? [] : ((data && data.state && data.state.habits) || []);
  const goals = emptyMode ? [] : ((data && data.state && data.state.goals) || []);
  const taskList = emptyMode ? [] : ((data && data.state && data.state.tasks) || []);
  const streak = useMemoHome(() => longestStreak(habits), [habits]);
  const goal = useMemoHome(() => nearestGoal(goals), [goals]);
  const tasks = useMemoHome(() => tasksThisWeek(taskList, todayDateOnly()), [taskList]);

  const fmt = (n) => Number(n).toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU');

  /* Category breakdown for the current month and the last 30 days, both
     from real transactions; categoryOverrides drops whole rows. */
  const today = todayDateOnly();
  const catBreakdown = useMemoHome(() => {
    if (emptyMode) return [];
    return F.byCategory(txAll.filter(tx => String(tx.date || '').slice(0, 7) === today.slice(0, 7)), overrides);
  }, [emptyMode, txAll, overrides, today]);
  const catBreakdown30 = useMemoHome(() => {
    if (emptyMode) return [];
    const from = shiftDate(today, -29);
    return F.byCategory(txAll.filter(tx => String(tx.date || '') >= from && String(tx.date || '') <= today), overrides);
  }, [emptyMode, txAll, overrides, today]);

  const allCatsHidden = !emptyMode && F.allCategoriesHidden(overrides, LifeExpenseCats || []);

  const cards = useMemoHome(() => ([
    {
      id: 'budget',
      eyebrow: t('home_card_budget'),
      value:   budget.capUsd > 0 && budgetPct != null ? `${budgetPct}%` : null,
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
        ? t('home_card_streak_ctx', streak.name || t(streak.habitKey), streak.days, t.pl('pl_day', streak.days))
        : '',
      emptyContext: t('home_card_streak_empty'),
      onClick: () => onNav('habits'),
    },
    {
      id: 'goal',
      eyebrow: t('home_card_goal'),
      value:   goal && goal.pct > 0 ? `${goal.pct}%` : null,
      context: goal ? (goal.title || t(goal.titleKey)) : '',
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
          <StatCard key={c.id}
                           eyebrow={c.eyebrow}
                           value={c.value}
                           valueClass={c.valueClass}
                           context={c.context}
                           emptyContext={c.emptyContext}
                           onClick={c.onClick} />
        ))}
      </section>

      {/* system signals — below the first ordinary panel row, never above it */}
      {signalsReady && !emptyMode ? (
        <HomeSignals
          analytics={analytics}
          projects={(data && data.state && data.state.projects) || []}
          onNav={onNav}
          t={t} />
      ) : null}

      {/* charts row — trend (left) + categories (right). 50/50 ≥960px, stacked below. */}
      <section className="home-charts">
        <TrendChart
          data={[]}
          onNav={onNav} />
        <CategoryChart
          monthData={allCatsHidden ? [] : catBreakdown}
          days30Data={allCatsHidden ? [] : catBreakdown30}
          capsByCat={{}}
          locale={locale}
          allHidden={allCatsHidden}
          allHiddenHint={t('home_cat_all_hidden')}
          onEmptyCta={() => onNav && onNav('finances')} />
      </section>

    </div>
  );
}

export { HomePage };
