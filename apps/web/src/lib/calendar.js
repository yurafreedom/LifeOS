import { LifeCalendarSeed } from '../data/calendar-seed.js';

/* lib/calendar.js
 *
 * Sprint 3B · per-day event aggregator for the redesigned calendar.
 *
 * Inputs:
 *   weekStart  Date — Monday 00:00 of the displayed week
 *   state      central state tree (LifeDataProvider)
 *   t          i18n function (so titles resolve to current locale)
 *
 * Output: 7 arrays (Mon..Sun) of event objects, each sorted by time.
 *   event = {
 *     id:     stable string,
 *     time:   'HH:MM',         // 24h, used for sort + display
 *     title:  string,          // resolved
 *     kind:   'stakes'|'routine'|'info',
 *     source: 'task'|'health'|'work'|'bill'|'med'|'dog'|'social',
 *     entity: { type, id? }    // for click routing
 *   }
 *
 * Source mix (Sprint 3B):
 *   1. seed pool (LifeCalendarSeed) — anchored to weekStart by dayOffset
 *   2. state.tasks — only those whose `due` field is parseable as a
 *      day in the current week (eod → today, 'HH:MM' → today, weekday
 *      codes → that weekday).
 *   3. state.dog.feeding.meals — repeat daily, 7 days, kind=info,
 *      source=dog. Only when meals[].time is set.
 *
 * NB: medications doses left as a future hook (the dispenser surface
 * doesn't yet expose "when next dose is due" cleanly; Sprint 4 wires
 * it). Bills are seeded directly in the pool.
 */

  const DOW_CODES = { 'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6 };

  function sameWeek(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  /* Parse a task.due string into { dayIdx, time }. Returns null if we
     can't place it. Conservative — we don't invent times. */
  function placeTask(due, todayIdx) {
    if (!due) return null;
    const s = String(due).trim().toLowerCase();
    if (s === 'eod')      return { dayIdx: todayIdx, time: '23:00' };
    if (s === 'tomorrow') return { dayIdx: Math.min(6, todayIdx + 1), time: '12:00' };
    if (/^\d{1,2}:\d{2}$/.test(s)) {
      const [h, m] = s.split(':');
      return { dayIdx: todayIdx, time: h.padStart(2, '0') + ':' + m };
    }
    if (DOW_CODES[s] != null) return { dayIdx: DOW_CODES[s], time: '12:00' };
    return null;
  }

  function aggregate(weekStart, state, t) {
    const days = [[], [], [], [], [], [], []];

    /* Today index inside the displayed week, or -1 if not this week. */
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let todayIdx = -1;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      if (sameWeek(d, today)) { todayIdx = i; break; }
    }

    /* 1 · seed pool */
    const seed = LifeCalendarSeed || [];
    seed.forEach((ev, i) => {
      const idx = ev.dayOffset;
      if (idx < 0 || idx > 6) return;
      days[idx].push({
        id:     'seed:' + i,
        time:   ev.time,
        title:  t(ev.titleKey),
        kind:   ev.kind,
        source: ev.source,
        entity: { type: 'seed', id: ev.titleKey },
      });
    });

    /* 2 · tasks — only when we can place them this week and only when
       the displayed week IS this calendar week. (Browsing prev/next
       week shouldn't fabricate task pills there.) */
    if (todayIdx >= 0 && Array.isArray(state.tasks)) {
      state.tasks.forEach(task => {
        if (task.done) return;
        const placed = placeTask(task.due, todayIdx);
        if (!placed) return;
        const title = task.titleKey ? t(task.titleKey)
                    : (task.title || task.title_ru || '');
        if (!title) return;
        days[placed.dayIdx].push({
          id:     'task:' + task.id,
          time:   placed.time,
          title:  title,
          kind:   task.stakes ? 'stakes' : 'routine',
          source: 'task',
          entity: { type: 'task', id: task.id },
        });
      });
    }

    /* 3 · dog feedings — only when the user has set actual times. We
       skip empty placeholder rows so we don't dilute density with
       fake content. */
    const meals = state.dog && state.dog.feeding && state.dog.feeding.meals;
    if (Array.isArray(meals)) {
      meals.forEach((meal, mi) => {
        if (!meal.time || !/^\d{1,2}:\d{2}$/.test(meal.time)) return;
        for (let i = 0; i < 7; i++) {
          days[i].push({
            id:     'dog:' + meal.id + ':' + i,
            time:   meal.time,
            title:  t('cal_seed_dog_feed'),
            kind:   'info',
            source: 'dog',
            entity: { type: 'dog', id: meal.id },
          });
        }
      });
    }

    /* sort each bucket by time */
    days.forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));

    return { days, todayIdx };
  }

  const LifeCalendar = { aggregate };

export { LifeCalendar };
