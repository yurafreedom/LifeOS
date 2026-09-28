import React from 'react';

const { useEffect, useState } = React;

/* ── Sidebar collapse persistence ──────────────────────────
   localStorage.lifeOsSidebar = 'collapsed' | 'expanded' (default expanded).
   Synced to <html> data-sb attribute so CSS can react if it ever needs to. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsedRaw] = useState(() => {
    try { return localStorage.getItem('lifeOsSidebar') === 'collapsed'; }
    catch (e) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lifeOsSidebar', collapsed ? 'collapsed' : 'expanded'); }
    catch (e) {}
  }, [collapsed]);
  function setCollapsed(next) {
    setCollapsedRaw(typeof next === 'function' ? next : !!next);
  }
  return [collapsed, setCollapsed];
}

export { useSidebarCollapsed };
