/* Links from security mail (JENKIN S1): #/auth/{reset|verify|invite}/<token>.
 *
 * The token travels in the URL fragment, so it never reaches a server log or a
 * Referer. It is read once and immediately removed from the address bar and
 * the session history (replaceState), then held only in component state. */

const ACTION = /^#\/auth\/(reset|verify|invite)\/([A-Za-z0-9_-]{20,200})$/;

export function readAuthAction(hash) {
  const match = ACTION.exec(hash || '');
  return match ? { kind: match[1], token: match[2] } : null;
}

/** Read the action (if any) and scrub the token from the URL. */
export function takeAuthAction(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return null;
  const action = readAuthAction(win.location.hash);
  if (!action) return null;
  try {
    win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}#/auth/${action.kind}`);
  } catch {
    /* history unavailable: the token stays in this tab's URL only */
  }
  return action;
}
