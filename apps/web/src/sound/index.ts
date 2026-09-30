/* UI sound facade — the only import path for app code.
 *
 *   sfx.emit('task.complete')   semantic event at the app's success boundary
 *   sfx.preview('click')        audition a clip (Settings only)
 *   installUiSound()            delegated listeners; returns detach (StrictMode safe)
 *
 * Module import has no side effects: no window access, no audio, no fetch.
 */
import { SoundEngine } from './engine';
import { GestureArbiter, installSoundGestures } from './gestures';
import type { SoundEventId } from './catalog';
import {
  SOUND_STORAGE_KEY,
  defaultSoundPreferences,
  readSoundPreferences,
  writeSoundPreferences,
  type SoundPreferences,
} from './preferences';

export { SOUND_ASSETS, SOUND_EVENTS, soundAsset, soundEvent } from './catalog';
export type { SoundAsset, SoundEvent, SoundEventId } from './catalog';
export { defaultSoundPreferences, type SoundPreferences } from './preferences';

let engine: SoundEngine | null = null;
let arbiter: GestureArbiter | null = null;
let prefs: SoundPreferences | null = null;
const listeners = new Set<() => void>();
let installs = 0;
let detach: (() => void) | null = null;

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function getEngine(): SoundEngine {
  if (!engine) {
    engine = new SoundEngine();
    engine.setPreferences(getSoundPreferences());
  }
  return engine;
}

function getArbiter(): GestureArbiter {
  if (!arbiter) arbiter = new GestureArbiter({ play: event => getEngine().play(event) });
  return arbiter;
}

export function getSoundPreferences(): SoundPreferences {
  if (!prefs) prefs = typeof window === 'undefined' ? defaultSoundPreferences() : readSoundPreferences(storage());
  return prefs;
}

export function setSoundPreferences(next: SoundPreferences): void {
  prefs = next;
  writeSoundPreferences(storage(), next);
  engine?.setPreferences(next);
  if (next.enabled) engine?.prefetchAssigned();
  for (const listener of listeners) listener();
}

export function subscribeSoundPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const sfx = {
  /** Report a semantic event. Never throws; no-op before the first gesture. */
  emit(event: SoundEventId): void {
    try {
      if (typeof window === 'undefined') return;
      getArbiter().emit(event);
    } catch {
      /* sound never affects the action that emitted it */
    }
  },
  preview(assetId: string): boolean {
    return getEngine().preview(assetId);
  },
  stopPreview(): void {
    engine?.stopPreview();
  },
};

/** Install the delegated gesture + hover listeners once per page. */
export function installUiSound(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  installs += 1;
  if (!detach) {
    const soundEngine = getEngine();
    const removeGestures = installSoundGestures({
      doc: document,
      win: window,
      arbiter: getArbiter(),
      unlock: () => soundEngine.unlock(),
      playHover: event => soundEngine.play(event),
      now: () => performance.now(),
      lastActivationAt: () => soundEngine.lastActivationAt,
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SOUND_STORAGE_KEY) return;
      prefs = readSoundPreferences(storage());
      soundEngine.setPreferences(prefs);
      for (const listener of listeners) listener();
    };
    window.addEventListener('storage', onStorage);
    detach = () => {
      removeGestures();
      window.removeEventListener('storage', onStorage);
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    installs -= 1;
    if (installs === 0 && detach) {
      detach();
      detach = null;
    }
  };
}
