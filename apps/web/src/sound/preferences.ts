/* Sound-effect preferences — a browser-local device setting, stored like the
 * theme (`lifeOsTheme`) and scene (`lifeOsScene`) keys: volume and whether a
 * device may make sound belong to the device, so no server field or migration.
 * Anything unreadable falls back to the defaults, field by field.
 */
import { SOUND_EVENTS, soundAsset, type SoundEventId } from './catalog';

export const SOUND_STORAGE_KEY = 'lifeOsSfx';

export interface SoundPreferences {
  enabled: boolean;
  /** Master volume, 0…1. */
  volume: number;
  hover: boolean;
  /** Event → asset id, or null for "None". */
  assignments: Record<SoundEventId, string | null>;
}

export const DEFAULT_VOLUME = 0.25;

export function defaultAssignments(): Record<SoundEventId, string | null> {
  const out = {} as Record<SoundEventId, string | null>;
  for (const event of SOUND_EVENTS) out[event.id] = event.defaultAsset;
  return out;
}

export function defaultSoundPreferences(): SoundPreferences {
  return { enabled: true, volume: DEFAULT_VOLUME, hover: false, assignments: defaultAssignments() };
}

function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

/** Validate an untrusted value into complete preferences. */
export function normalizeSoundPreferences(raw: unknown): SoundPreferences {
  const base = defaultSoundPreferences();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Record<string, unknown>;
  const stored = input.assignments && typeof input.assignments === 'object'
    ? input.assignments as Record<string, unknown> : {};
  const assignments = base.assignments;
  for (const event of SOUND_EVENTS) {
    if (!(event.id in stored)) continue;
    const value = stored[event.id];
    if (value === null) assignments[event.id] = null;
    else if (typeof value === 'string' && soundAsset(value)) assignments[event.id] = value;
  }
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : base.enabled,
    volume: 'volume' in input ? clampVolume(input.volume) : base.volume,
    hover: typeof input.hover === 'boolean' ? input.hover : base.hover,
    assignments,
  };
}

export function parseSoundPreferences(text: string | null): SoundPreferences {
  if (!text) return defaultSoundPreferences();
  try {
    return normalizeSoundPreferences(JSON.parse(text));
  } catch {
    return defaultSoundPreferences();
  }
}

export function readSoundPreferences(storage: Pick<Storage, 'getItem'> | null | undefined): SoundPreferences {
  try {
    return parseSoundPreferences(storage ? storage.getItem(SOUND_STORAGE_KEY) : null);
  } catch {
    return defaultSoundPreferences();
  }
}

export function writeSoundPreferences(storage: Pick<Storage, 'setItem'> | null | undefined, prefs: SoundPreferences): void {
  try {
    storage?.setItem(SOUND_STORAGE_KEY, JSON.stringify({ v: 1, ...prefs }));
  } catch {
    /* private mode / quota: the preference simply does not persist */
  }
}
