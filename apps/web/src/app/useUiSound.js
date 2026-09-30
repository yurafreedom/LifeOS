import React from 'react';
import {
  getSoundPreferences,
  installUiSound,
  setSoundPreferences,
  subscribeSoundPreferences,
} from '../sound/index.ts';

const { useEffect, useSyncExternalStore } = React;

/* UI sound effects — installs the delegated gesture/hover listeners for the
   app shell (see src/sound/gestures.ts). Detached on unmount; a StrictMode
   remount re-attaches exactly one set. */
function useUiSound() {
  useEffect(() => installUiSound(), []);
}

/* Settings read/write of the browser-local sound preferences. */
function useSoundPreferences() {
  const prefs = useSyncExternalStore(subscribeSoundPreferences, getSoundPreferences, getSoundPreferences);
  return [prefs, setSoundPreferences];
}

export { useSoundPreferences, useUiSound };
