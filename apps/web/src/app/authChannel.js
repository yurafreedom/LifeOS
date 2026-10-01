/* Cross-tab authentication notices (JENKIN S1).
 *
 * Every tab shares one session cookie. When a tab signs in, signs out or loses
 * its session it tells the others, which then *revalidate* with the server
 * (`GET /auth/me`): a message is only a hint, never trusted identity.
 *
 * BroadcastChannel where available; otherwise a `storage` event on a
 * device-local key carrying no identity, only a type and a nonce. */

const CHANNEL = 'lifeos-auth';
const STORAGE_KEY = 'lifeOsAuthEvent';
const TYPES = new Set(['signed_in', 'signed_out', 'session_changed']);

function nonce() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createAuthChannel(onMessage) {
  const own = new Set();
  let channel = null;
  let storageHandler = null;

  function deliver(message) {
    if (!message || !TYPES.has(message.type) || own.has(message.nonce)) return;
    onMessage({ type: message.type });
  }

  if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
    channel = new window.BroadcastChannel(CHANNEL);
    channel.onmessage = event => deliver(event.data);
  } else if (typeof window !== 'undefined') {
    storageHandler = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { deliver(JSON.parse(event.newValue)); } catch { /* ignore malformed */ }
    };
    window.addEventListener('storage', storageHandler);
  }

  return {
    post(type) {
      if (!TYPES.has(type)) return;
      const message = { type, nonce: nonce() };
      own.add(message.nonce);
      if (channel) {
        channel.postMessage(message);
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
      } catch { /* other tabs still revalidate on focus */ }
    },
    close() {
      if (channel) channel.close();
      if (storageHandler) window.removeEventListener('storage', storageHandler);
    },
  };
}
