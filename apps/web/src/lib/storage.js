

/* lib/storage.js
 *
 * localStorage persistence for the entire Life OS state tree.
 *
 * Contract:
 *   loadState()      → parsed object | null
 *   saveState(state) → throttled write (500ms trailing edge)
 *
 * Single key: 'lifeOsState'. No eviction, no migration scaffolding
 * yet — version field is reserved on the state object for when we
 * need it (Sprint 5+ / v3.0 backend port).
 *
 * Safe against quota errors and disabled storage (private mode):
 * swallowed silently so nothing crashes; in-memory state still
 * works for the session. */

  var KEY = 'lifeOsState';
  var THROTTLE_MS = 500;

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  /* Throttled trailing-edge writer. Multiple rapid setState calls
     during a single interaction collapse into one write, but the
     LAST state always lands within THROTTLE_MS. */
  var pending = null;
  var timer = null;
  var lastFlush = 0;

  function flushNow() {
    if (pending == null) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(pending));
    } catch (e) {
      /* quota, private mode, etc — silent */
    }
    pending = null;
    lastFlush = Date.now();
    timer = null;
  }

  function saveState(state) {
    pending = state;
    if (timer) return;
    var elapsed = Date.now() - lastFlush;
    var wait = elapsed >= THROTTLE_MS ? 0 : (THROTTLE_MS - elapsed);
    timer = setTimeout(flushNow, wait);
  }

  function clearState() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    pending = null;
    if (timer) { clearTimeout(timer); timer = null; }
  }

  /* Force-flush on page hide so a refresh mid-throttle doesn't
     lose the most recent change. */
  window.addEventListener('beforeunload', flushNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });

  const LifeStorage = {
    load:  loadState,
    save:  saveState,
    clear: clearState,
    flush: flushNow,
    KEY:   KEY,
  };

export { LifeStorage };
