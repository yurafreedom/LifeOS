/* Sound engine — Web Audio playback of short cues from decoded buffers.
 *
 *   · the AudioContext is created only inside a user gesture (`unlock`), so
 *     nothing plays or loads on page load, hydration or background work;
 *   · each clip is fetched + decoded once, on first need; a failed load is
 *     retried no sooner than RETRY_MS later;
 *   · playback is bounded by the asset's start/end inside the buffer;
 *   · one voice per channel (a new cue fades the previous one out) and at most
 *     MAX_VOICES overall, so rapid repeats never stack;
 *   · a cue whose clip is not decoded within LATE_MS is dropped, never played
 *     late;
 *   · every audio failure is swallowed: sound never blocks or fails an action.
 */
import { soundAsset, soundEvent, type SoundAsset, type SoundChannel, type SoundEventId } from './catalog';
import { defaultSoundPreferences, type SoundPreferences } from './preferences';

/* The slice of the Web Audio API the engine uses — narrow so tests can mock it. */
export interface GainLike {
  gain: { value: number; setTargetAtTime(value: number, when: number, constant: number): unknown; cancelScheduledValues(when: number): unknown };
  connect(node: unknown): unknown;
  disconnect(): void;
}
export interface SourceLike {
  buffer: unknown;
  onended: (() => void) | null;
  connect(node: unknown): unknown;
  start(when: number, offset: number, duration: number): void;
  stop(when?: number): void;
  disconnect(): void;
}
export interface ContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<unknown>;
  createGain(): GainLike;
  createBufferSource(): SourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
}

export interface EngineDeps {
  createContext: () => ContextLike | null;
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
  now: () => number;
}

export const MAX_VOICES = 6;
export const LATE_MS = 120;
export const RETRY_MS = 10_000;
export const HOVER_BUS = 0.5;
const FADE = 0.012;
const REPEAT_GUARD_MS = 40;

interface Voice { source: SourceLike; gain: GainLike; channel: SoundChannel; startedAt: number }

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function browserDeps(): EngineDeps {
  return {
    createContext() {
      const w = globalThis as unknown as { AudioContext?: new () => ContextLike; webkitAudioContext?: new () => ContextLike };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    },
    async fetchBytes(url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`sound ${response.status}`);
      return response.arrayBuffer();
    },
    now: () => (globalThis.performance ? globalThis.performance.now() : Date.now()),
  };
}

export class SoundEngine {
  private deps: EngineDeps;
  private ctx: ContextLike | null = null;
  private master: GainLike | null = null;
  private prefs: SoundPreferences = defaultSoundPreferences();
  private buffers = new Map<string, unknown>();
  private loading = new Map<string, Promise<unknown>>();
  private failedAt = new Map<string, number>();
  private voices: Voice[] = [];
  private lastPlayed = new Map<string, number>();
  private lastCueAt = -Infinity;
  /** Last swallowed error, for diagnostics only. */
  lastError: unknown = null;

  constructor(deps: Partial<EngineDeps> = {}) {
    this.deps = { ...browserDeps(), ...deps };
  }

  get preferences(): SoundPreferences { return this.prefs; }
  get unlocked(): boolean { return !!this.ctx; }
  get activeVoices(): number { return this.voices.length; }

  setPreferences(prefs: SoundPreferences): void {
    this.prefs = prefs;
    if (this.master) this.master.gain.value = prefs.volume;
    if (!prefs.enabled) this.stopAll(['preview']);
    else if (!prefs.hover) this.stopChannel('hover');
  }

  /** Create/resume the AudioContext. Call from a trusted user gesture only. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const ctx = this.deps.createContext();
        if (!ctx) return;
        const master = ctx.createGain();
        master.gain.value = this.prefs.volume;
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.prefetchAssigned();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(error => { this.lastError = error; });
    } catch (error) {
      this.lastError = error;
    }
  }

  /** Warm the clips the current preferences can play (not the whole library). */
  prefetchAssigned(): void {
    if (!this.ctx || !this.prefs.enabled) return;
    for (const [eventId, assetId] of Object.entries(this.prefs.assignments)) {
      const event = soundEvent(eventId);
      if (!assetId || !event || (event.hover && !this.prefs.hover)) continue;
      const asset = soundAsset(assetId);
      if (asset) void this.load(asset);
    }
  }

  /** Play a semantic event. Returns true when a cue was started or queued. */
  play(eventId: SoundEventId): boolean {
    try {
      const event = soundEvent(eventId);
      if (!event || !this.prefs.enabled || !this.ctx) return false;
      if (event.hover && !this.prefs.hover) return false;
      const asset = soundAsset(this.prefs.assignments[event.id]);
      if (!asset) return false;
      const now = this.deps.now();
      const last = this.lastPlayed.get(event.id);
      if (last !== undefined && now - last < REPEAT_GUARD_MS) return false;
      this.lastPlayed.set(event.id, now);
      return this.start(asset, event.channel, event.hover ? HOVER_BUS : 1, now);
    } catch (error) {
      this.lastError = error;
      return false;
    }
  }

  /** Audition an asset at the master volume, regardless of the master switch. */
  preview(assetId: string): boolean {
    try {
      this.unlock();
      const asset = soundAsset(assetId);
      if (!asset || !this.ctx) return false;
      return this.start(asset, 'preview', 1, this.deps.now());
    } catch (error) {
      this.lastError = error;
      return false;
    }
  }

  stopPreview(): void { this.stopChannel('preview'); }

  /** Time (ms, engine clock) of the last non-hover cue — hover stays subordinate. */
  get lastActivationAt(): number { return this.lastCueAt; }

  stopAll(except: SoundChannel[] = []): void {
    for (const voice of [...this.voices]) if (!except.includes(voice.channel)) this.release(voice);
  }

  private stopChannel(channel: SoundChannel): void {
    for (const voice of [...this.voices]) if (voice.channel === channel) this.release(voice);
  }

  private start(asset: SoundAsset, channel: SoundChannel, bus: number, requestedAt: number): boolean {
    if (channel !== 'hover' && channel !== 'preview') this.lastCueAt = requestedAt;
    if (channel === 'preview') this.stopChannel('preview');
    const buffer = this.buffers.get(asset.id);
    if (buffer) {
      this.voice(asset, buffer, channel, bus);
      return true;
    }
    const pending = this.load(asset);
    if (!pending) return false;
    pending.then(decoded => {
      if (!decoded || this.deps.now() - requestedAt > LATE_MS) return;
      if (channel !== 'preview' && !this.prefs.enabled) return;
      this.voice(asset, decoded, channel, bus);
    }, () => undefined);
    return true;
  }

  private load(asset: SoundAsset): Promise<unknown> | null {
    const ready = this.buffers.get(asset.id);
    if (ready) return Promise.resolve(ready);
    const inFlight = this.loading.get(asset.id);
    if (inFlight) return inFlight;
    const failed = this.failedAt.get(asset.id);
    if (failed !== undefined && this.deps.now() - failed < RETRY_MS) return null;
    const ctx = this.ctx;
    if (!ctx) return null;
    const request = this.deps.fetchBytes(asset.url)
      .then(bytes => ctx.decodeAudioData(bytes))
      .then(decoded => {
        this.buffers.set(asset.id, decoded);
        this.failedAt.delete(asset.id);
        return decoded;
      }, error => {
        this.lastError = error;
        this.failedAt.set(asset.id, this.deps.now());
        return null;
      })
      .finally(() => { this.loading.delete(asset.id); });
    this.loading.set(asset.id, request);
    return request;
  }

  private voice(asset: SoundAsset, buffer: unknown, channel: SoundChannel, bus: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    try {
      this.stopChannel(channel);
      while (this.voices.length >= MAX_VOICES) this.release(this.voices[0]);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = dbToGain(asset.gainDb) * bus;
      source.connect(gain);
      gain.connect(master);
      const voice: Voice = { source, gain, channel, startedAt: ctx.currentTime };
      source.onended = () => {
        this.forget(voice);
        try { source.disconnect(); gain.disconnect(); } catch { /* already detached */ }
      };
      this.voices.push(voice);
      source.start(0, asset.start, Math.max(0.01, asset.end - asset.start));
    } catch (error) {
      this.lastError = error;
    }
  }

  private release(voice: Voice): void {
    this.forget(voice);
    try {
      const t = this.ctx ? this.ctx.currentTime : 0;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, FADE / 3);
      voice.source.stop(t + FADE * 2);
    } catch (error) {
      this.lastError = error;
    }
  }

  private forget(voice: Voice): void {
    const index = this.voices.indexOf(voice);
    if (index !== -1) this.voices.splice(index, 1);
  }
}
