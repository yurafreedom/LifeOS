import React from 'react';
import { msUntilNextDay, todayDateOnly } from '../domain/calendarModel.ts';

const { useEffect, useState } = React;

/* The current Europe/Kyiv calendar day, kept fresh while a page stays open.
 *
 * A render-time `todayDateOnly()` goes stale at midnight. This re-reads the
 * clock at the next Kyiv midnight (one timer, re-armed each time; capped at an
 * hour so a sleeping laptop or a changed system clock is corrected within the
 * hour even if the timer fires late) and whenever the tab becomes visible
 * again, regains focus or is restored from the back/forward cache. Only an
 * actual change of day updates state, so this never re-renders every tick. */

export const MAX_DAY_TIMER_MS = 60 * 60 * 1000;

/** Framework-free watcher (testable without a DOM). Returns a disposer. */
export function watchKyivDay({ now = () => Date.now(), onDay, timers = globalThis, target = globalThis, doc = globalThis.document }) {
  let current = todayDateOnly(now());
  let timer = null;
  let disposed = false;

  function check() {
    if (disposed) return;
    const day = todayDateOnly(now());
    if (day !== current) {
      current = day;
      onDay(day);
    }
  }
  function arm() {
    if (disposed) return;
    timers.clearTimeout(timer);
    /* +250 ms lands safely after midnight rather than a hair before it. */
    const wait = Math.min(msUntilNextDay(now()) + 250, MAX_DAY_TIMER_MS);
    timer = timers.setTimeout(() => { check(); arm(); }, wait);
  }
  /* Any wake-up re-reads the day (cheap: state changes only on a new day). */
  function wake() {
    check();
    arm();
  }

  arm();
  doc && doc.addEventListener && doc.addEventListener('visibilitychange', wake);
  target.addEventListener && target.addEventListener('focus', wake);
  target.addEventListener && target.addEventListener('pageshow', wake);
  return () => {
    disposed = true;
    timers.clearTimeout(timer);
    doc && doc.removeEventListener && doc.removeEventListener('visibilitychange', wake);
    target.removeEventListener && target.removeEventListener('focus', wake);
    target.removeEventListener && target.removeEventListener('pageshow', wake);
  };
}

function useKyivToday() {
  const [today, setToday] = useState(() => todayDateOnly());
  useEffect(() => {
    /* The day may already have changed between the first render and mount. */
    setToday(todayDateOnly());
    return watchKyivDay({ onDay: setToday, timers: window, target: window, doc: document });
  }, []);
  return today;
}

export { useKyivToday };
