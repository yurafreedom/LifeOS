import React from 'react';

const { useEffect, useState } = React;

/* ── Theme controller ────────────────────────────────────── */
function useTheme() {
  const [prefMode, setPrefMode] = useState(() => {
    try {
      const v = localStorage.getItem('lifeOsTheme');
      if (v === 'dark' || v === 'light' || v === 'paradise') return v;
    } catch (e) {}
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  );

  /* Manual paradise-scene override. localStorage.lifeOsScene =
     'day' | 'night' forces that scene and disables the clock; absent /
     any other value = 'auto' (clock-driven, the original behavior).
     Kept in its own key like lifeOsTheme / lifeOsSidebar. */
  const [scenePref, setScenePrefRaw] = useState(() => {
    try {
      const v = localStorage.getItem('lifeOsScene');
      if (v === 'day' || v === 'night') return v;
    } catch (e) {}
    return 'auto';
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = e => setSystemTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
    };
  }, []);

  const effective = prefMode === 'system' ? systemTheme : prefMode;

  useEffect(() => {
    /* Suppress transitions across the theme swap. Translucent surfaces
       fed by var(--surface) with a background-color transition otherwise
       get "stuck" at the old value (custom-property transition repaint
       bug) — disabling transitions makes the new tokens apply instantly,
       then we restore them next frame for normal hover animation. */
    const el = document.documentElement;
    el.classList.add('theme-switching');
    el.setAttribute('data-theme', effective);
    void el.offsetHeight; /* force reflow with transitions off */
    const id = requestAnimationFrame(() => el.classList.remove('theme-switching'));
    return () => cancelAnimationFrame(id);
  }, [effective]);

  /* Sprint 3.6 · paradise scene clock — when paradise is active,
     data-scene="day"|"night" is resolved from Kyiv time (day 06:00–19:59)
     and re-checked every 60s. Removed entirely under dark/light.
     scenePref === 'day'|'night' overrides the clock: it forces that scene
     and SKIPS the recompute + 60s interval so the next tick can't revert
     it. scenePref === 'auto' keeps the clock behavior exactly as before. */
  useEffect(() => {
    const el = document.documentElement;
    if (effective !== 'paradise') {
      el.removeAttribute('data-scene');
      return;
    }
    /* Swap data-scene with the var()-fed-transition freeze (Sprint 3.5):
       kill .app transitions for one frame around the scene token swap so
       cards/sidebar snap to the new scene's values instead of freezing
       mid-transition. The scene layers sit outside .app, so their 1.4s
       crossfade is unaffected. */
    function setScene(next) {
      if (el.getAttribute('data-scene') === next) return;
      el.classList.add('scene-switching');
      el.setAttribute('data-scene', next);
      void el.offsetHeight;
      requestAnimationFrame(() => el.classList.remove('scene-switching'));
    }
    /* Manual override — force the chosen scene, no clock, no interval. */
    if (scenePref === 'day' || scenePref === 'night') {
      setScene(scenePref);
      return;
    }
    /* Auto — original clock behavior. */
    function kyivHour() {
      try {
        return parseInt(new Intl.DateTimeFormat('en-US',
          { timeZone: 'Europe/Kiev', hour: 'numeric', hour12: false })
          .format(new Date()), 10) % 24;
      } catch (e) { return new Date().getHours(); }
    }
    function applyScene() {
      const h = kyivHour();
      setScene((h >= 20 || h < 6) ? 'night' : 'day');
    }
    applyScene();
    const id = setInterval(applyScene, 60000);
    return () => clearInterval(id);
  }, [effective, scenePref]);

  function setTheme(next) {
    setPrefMode(next);
    try {
      if (next === 'system') localStorage.removeItem('lifeOsTheme');
      else                   localStorage.setItem('lifeOsTheme', next);
    } catch (e) {}
  }

  function setScenePref(next) {
    setScenePrefRaw(next);
    try {
      if (next === 'day' || next === 'night') localStorage.setItem('lifeOsScene', next);
      else                                     localStorage.removeItem('lifeOsScene');
    } catch (e) {}
  }

  return [prefMode, effective, setTheme, scenePref, setScenePref];
}

export { useTheme };
