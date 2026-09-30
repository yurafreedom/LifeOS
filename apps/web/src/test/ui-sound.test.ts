import { describe, expect, it, vi } from 'vitest';

import { SOUND_ASSETS, SOUND_EVENTS, soundAsset, type SoundEventId } from '../sound/catalog';
import { HOVER_BUS, LATE_MS, MAX_VOICES, RETRY_MS, SoundEngine, dbToGain, type ContextLike } from '../sound/engine';
import {
  CONTROL_SELECTOR,
  GestureArbiter,
  HOVER_AFTER_ACTIVATION_MS,
  HOVER_MIN_GAP_MS,
  HOVER_MOVE_WINDOW_MS,
  activationEvent,
  installSoundGestures,
  resolveControl,
} from '../sound/gestures';
import {
  DEFAULT_VOLUME,
  SOUND_STORAGE_KEY,
  defaultSoundPreferences,
  normalizeSoundPreferences,
  parseSoundPreferences,
  readSoundPreferences,
  writeSoundPreferences,
  type SoundPreferences,
} from '../sound/preferences';

/* Unit tests run against mocked audio and DOM objects. They prove routing,
   gating and bookkeeping — not that anything is audible. */

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/* ── Fake Web Audio ─────────────────────────────────────── */
function fakeAudio() {
  const sources: any[] = [];
  const gains: any[] = [];
  const ctx: any = {
    state: 'suspended', currentTime: 0, destination: { id: 'out' },
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    createGain() {
      const node = { gain: { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const node: any = { buffer: null, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      sources.push(node);
      return node;
    },
    decodeAudioData: vi.fn(async (bytes: ArrayBuffer) => ({ decoded: bytes })),
  };
  return { ctx: ctx as ContextLike & typeof ctx, sources, gains };
}

function engineWith(prefs: Partial<SoundPreferences> = {}, overrides: Record<string, unknown> = {}) {
  const audio = fakeAudio();
  const clock = { t: 1000 };
  const fetchBytes = vi.fn(async (_url: string) => new ArrayBuffer(4));
  const engine = new SoundEngine({ createContext: () => audio.ctx, fetchBytes, now: () => clock.t, ...overrides });
  engine.setPreferences({ ...defaultSoundPreferences(), ...prefs });
  return { engine, audio, clock, fetchBytes };
}

async function unlocked(prefs: Partial<SoundPreferences> = {}) {
  const setup = engineWith(prefs);
  setup.engine.unlock();
  await flush();
  return setup;
}

describe('sound preferences', () => {
  it('defaults to enabled, 25% volume, hover off, filename-based assignments', () => {
    const prefs = defaultSoundPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(0.25);
    expect(DEFAULT_VOLUME).toBe(0.25);
    expect(prefs.hover).toBe(false);
    expect(prefs.assignments['control.activate']).toBe('click');
    expect(prefs.assignments['menu.open']).toBe('menu_in');
    expect(prefs.assignments['menu.close']).toBe('menu_out');
    expect(prefs.assignments['panel.expand']).toBe('expand');
    expect(prefs.assignments['modal.close']).toBe('close_window');
    expect(prefs.assignments['hover.enter']).toBe('hover_ui_in');
    expect(prefs.assignments['hover.cta.leave']).toBe('hover_cta_out');
    expect(prefs.assignments['panel.collapse']).toBeNull();
  });

  it('falls back to defaults for missing, malformed or hostile storage', () => {
    expect(parseSoundPreferences(null)).toEqual(defaultSoundPreferences());
    expect(parseSoundPreferences('{not json')).toEqual(defaultSoundPreferences());
    expect(parseSoundPreferences('"a string"')).toEqual(defaultSoundPreferences());
    expect(parseSoundPreferences('[1,2]').volume).toBe(0.25);
    const throwing = { getItem: () => { throw new Error('denied'); } };
    expect(readSoundPreferences(throwing)).toEqual(defaultSoundPreferences());
    expect(() => writeSoundPreferences({ setItem: () => { throw new Error('quota'); } }, defaultSoundPreferences())).not.toThrow();
  });

  it('validates each field independently', () => {
    const prefs = normalizeSoundPreferences({
      enabled: 'yes', volume: 7, hover: true,
      assignments: { 'control.activate': null, 'menu.open': 'nope.mp3', 'bogus.event': 'click', 'save.success': 'sfx_seg03' },
    });
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(1);
    expect(prefs.hover).toBe(true);
    expect(prefs.assignments['control.activate']).toBeNull();
    expect(prefs.assignments['menu.open']).toBe('menu_in');
    expect(prefs.assignments['save.success']).toBe('sfx_seg03');
    expect(prefs.assignments).not.toHaveProperty('bogus.event');
    expect(normalizeSoundPreferences({ volume: -3 }).volume).toBe(0);
    expect(normalizeSoundPreferences({ volume: Number.NaN }).volume).toBe(0.25);
    expect(normalizeSoundPreferences({ volume: 0.333 }).volume).toBe(0.33);
  });

  it('round-trips through storage under the lifeOsSfx key', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const prefs = { ...defaultSoundPreferences(), enabled: false, volume: 0.6, hover: true };
    prefs.assignments['task.complete'] = null;
    writeSoundPreferences(storage, prefs);
    expect([...store.keys()]).toEqual([SOUND_STORAGE_KEY]);
    expect(readSoundPreferences(storage)).toEqual(prefs);
  });
});

describe('sound catalog', () => {
  it('assigns only existing assets and keeps every playback window inside the clip', () => {
    for (const event of SOUND_EVENTS) if (event.defaultAsset) expect(soundAsset(event.defaultAsset)).toBeTruthy();
    for (const asset of SOUND_ASSETS) {
      expect(asset.start).toBeGreaterThanOrEqual(0);
      expect(asset.end).toBeGreaterThan(asset.start);
      expect(Math.abs(asset.gainDb)).toBeLessThanOrEqual(12);
      expect(typeof asset.url).toBe('string');
    }
    expect(new Set(SOUND_ASSETS.map(asset => asset.id)).size).toBe(SOUND_ASSETS.length);
    expect(SOUND_ASSETS.some(asset => asset.file === 'sfx.mp3')).toBe(false);
  });

  it('leaves quick_buildup and the sfx.mp3 variants unassigned by default', () => {
    const used = new Set(SOUND_EVENTS.map(event => event.defaultAsset));
    for (const id of ['quick_buildup', 'sfx_seg01', 'sfx_seg03', 'sfx_seg07', 'sfx_seg08', 'sfx_seg12']) expect(used.has(id)).toBe(false);
  });
});

describe('sound engine', () => {
  it('does nothing before a user gesture unlocks audio', () => {
    const { engine, fetchBytes, audio } = engineWith();
    expect(engine.play('control.activate')).toBe(false);
    expect(fetchBytes).not.toHaveBeenCalled();
    expect(audio.sources).toHaveLength(0);
  });

  it('unlocks once and prefetches only assigned, currently playable clips', async () => {
    const { engine, audio, fetchBytes } = await unlocked();
    engine.unlock();
    expect(audio.ctx.resume).toHaveBeenCalled();
    const fetched = fetchBytes.mock.calls.map(([url]) => url);
    const expected = SOUND_EVENTS.filter(e => e.defaultAsset && !e.hover).map(e => soundAsset(e.defaultAsset)!.url);
    expect(new Set(fetched)).toEqual(new Set(expected));
    expect(fetched.some(url => url === soundAsset('hover_ui_in')!.url)).toBe(false);
  });

  it('plays the assigned clip inside its bounded window through a master gain at the volume', async () => {
    const { engine, audio } = await unlocked({ volume: 0.4 });
    expect(engine.play('control.activate')).toBe(true);
    const source = audio.sources.at(-1);
    const click = soundAsset('click')!;
    expect(source.start).toHaveBeenCalledWith(0, click.start, click.end - click.start);
    expect(audio.gains[0].gain.value).toBe(0.4);
    expect(audio.gains.at(-1).gain.value).toBeCloseTo(dbToGain(click.gainDb));
  });

  it('treats "None" as silence', async () => {
    const prefs = defaultSoundPreferences();
    prefs.assignments['control.activate'] = null;
    const { engine, audio } = await unlocked(prefs);
    expect(engine.play('control.activate')).toBe(false);
    expect(audio.sources).toHaveLength(0);
  });

  it('follows a reassignment immediately', async () => {
    const { engine, audio } = await unlocked();
    const prefs = defaultSoundPreferences();
    prefs.assignments['control.activate'] = 'close_window';
    engine.setPreferences(prefs);
    engine.play('control.activate');
    const window = soundAsset('close_window')!;
    expect(audio.sources.at(-1).start).toHaveBeenCalledWith(0, window.start, window.end - window.start);
  });

  it('mutes immediately: stops voices and refuses new cues; volume changes apply live', async () => {
    const { engine, audio, clock } = await unlocked();
    engine.play('menu.open');
    expect(engine.activeVoices).toBe(1);
    engine.setPreferences({ ...defaultSoundPreferences(), volume: 0.8 });
    expect(audio.gains[0].gain.value).toBe(0.8);
    engine.setPreferences({ ...defaultSoundPreferences(), enabled: false });
    expect(engine.activeVoices).toBe(0);
    expect(audio.sources[0].stop).toHaveBeenCalled();
    clock.t += 1000;
    expect(engine.play('control.activate')).toBe(false);
  });

  it('keeps one voice per channel and a global cap under rapid repeats', async () => {
    const { engine, audio, clock } = await unlocked();
    for (let i = 0; i < 20; i += 1) { clock.t += 50; engine.play('control.activate'); }
    expect(engine.activeVoices).toBe(1);
    expect(audio.sources.slice(0, -1).every(source => source.stop.mock.calls.length === 1)).toBe(true);
    for (const event of ['menu.open', 'panel.expand', 'modal.close', 'task.complete'] as SoundEventId[]) { clock.t += 50; engine.play(event); }
    expect(engine.activeVoices).toBeLessThanOrEqual(MAX_VOICES);
    expect(engine.activeVoices).toBe(5);
  });

  it('drops an identical event repeated within the duplicate guard', async () => {
    const { engine, audio, clock } = await unlocked();
    expect(engine.play('control.activate')).toBe(true);
    clock.t += 10;
    expect(engine.play('control.activate')).toBe(false);
    expect(audio.sources).toHaveLength(1);
  });

  it('keeps hover cues off unless enabled, and quieter than activation', async () => {
    const off = await unlocked();
    expect(off.engine.play('hover.enter')).toBe(false);
    const on = await unlocked({ hover: true });
    expect(on.engine.play('hover.enter')).toBe(true);
    await flush();
    const asset = soundAsset('hover_ui_in')!;
    expect(on.audio.gains.at(-1).gain.value).toBeCloseTo(dbToGain(asset.gainDb) * HOVER_BUS);
  });

  it('isolates failures: context, fetch, decode and start errors never throw', async () => {
    const broken = new SoundEngine({ createContext: () => { throw new Error('no audio'); } });
    expect(() => broken.unlock()).not.toThrow();
    expect(broken.play('control.activate')).toBe(false);

    const { engine, fetchBytes, clock } = engineWith({}, {});
    fetchBytes.mockRejectedValue(new Error('404'));
    engine.unlock();
    await flush(); await flush();
    const calls = fetchBytes.mock.calls.length;
    clock.t += 100;
    /* the failed prefetch is not retried on every click */
    expect(engine.play('control.activate')).toBe(false);
    expect(fetchBytes.mock.calls.length).toBe(calls);
    clock.t += RETRY_MS;
    engine.play('control.activate');
    expect(fetchBytes.mock.calls.length).toBe(calls + 1);

    const decodeFail = engineWith();
    decodeFail.audio.ctx.decodeAudioData.mockRejectedValue(new Error('bad mp3'));
    decodeFail.engine.unlock();
    await flush(); await flush();
    expect(() => decodeFail.engine.play('control.activate')).not.toThrow();

    const startFail = await unlocked();
    startFail.audio.ctx.createBufferSource = () => { throw new Error('graph'); };
    expect(() => startFail.engine.play('control.activate')).not.toThrow();
  });

  it('never plays a cue late: a clip decoded after the window is dropped', async () => {
    const audio = fakeAudio();
    const clock = { t: 0 };
    let resolveFetch: (value: ArrayBuffer) => void = () => undefined;
    const engine = new SoundEngine({
      createContext: () => audio.ctx,
      fetchBytes: () => new Promise(resolve => { resolveFetch = resolve; }),
      now: () => clock.t,
    });
    const prefs = defaultSoundPreferences();
    for (const key of Object.keys(prefs.assignments)) (prefs.assignments as any)[key] = null;
    prefs.assignments['control.activate'] = 'click';
    engine.setPreferences(prefs);
    engine.unlock();
    engine.play('control.activate');
    clock.t += LATE_MS + 1;
    resolveFetch(new ArrayBuffer(4));
    await flush(); await flush();
    expect(audio.sources).toHaveLength(0);
  });

  it('previews at the volume even when UI sounds are off, one preview at a time', async () => {
    const { engine, audio } = await unlocked({ enabled: false, volume: 0.3 });
    expect(engine.preview('release')).toBe(true);
    await flush(); await flush();
    expect(audio.sources).toHaveLength(1);
    expect(audio.gains[0].gain.value).toBe(0.3);
    engine.preview('decoding');
    await flush(); await flush();
    expect(audio.sources[0].stop).toHaveBeenCalled();
    expect(engine.activeVoices).toBe(1);
    engine.stopPreview();
    expect(engine.activeVoices).toBe(0);
  });
});

/* ── Minimal fake DOM for gesture routing ───────────────── */
const SIMPLE = /^([a-z]+)?(?:\.([\w-]+))?((?:\[[^\]]+\])*)$/;
class FakeEl {
  isConnected = true;
  disabled = false;
  rect = { width: 90, height: 32 };
  open = false;
  constructor(public tagName: string, public attrs: Record<string, string> = {}, public parent: FakeEl | null = null, public classes: string[] = []) {}
  get parentElement() { return this.parent; }
  getAttribute(name: string) { return name in this.attrs ? this.attrs[name] : null; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  getBoundingClientRect() { return this.rect; }
  matches(selector: string): boolean {
    return selector.split(',').some(part => {
      const m = SIMPLE.exec(part.trim());
      if (!m) throw new Error(`fake DOM cannot match ${part}`);
      if (m[1] && m[1].toUpperCase() !== this.tagName) return false;
      if (m[2] && !this.classes.includes(m[2])) return false;
      for (const [, name, value] of m[3].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (name === 'disabled' && this.tagName === 'FIELDSET' && !value) { if (!this.disabled) return false; continue; }
        const actual = this.getAttribute(name);
        if (actual === null || (value !== undefined && actual !== value)) return false;
      }
      return true;
    });
  }
  closest(selector: string): FakeEl | null {
    for (let el: FakeEl | null = this; el; el = el.parent) if (el.matches(selector)) return el;
    return null;
  }
}
const el = (tag: string, attrs: Record<string, string> = {}, parent: FakeEl | null = null, classes: string[] = []) =>
  new FakeEl(tag.toUpperCase(), attrs, parent, classes);

describe('control resolution', () => {
  it('finds the eligible control from nested content and ignores text, disabled and silenced areas', () => {
    const button = el('button');
    const icon = el('svg', {}, button);
    expect(resolveControl(icon as any)).toBe(button);
    expect(resolveControl(el('p') as any)).toBeNull();
    const disabled = el('button'); disabled.disabled = true;
    expect(resolveControl(disabled as any)).toBeNull();
    expect(resolveControl(el('button', { 'aria-disabled': 'true' }) as any)).toBeNull();
    const quiet = el('div', { 'data-sfx': 'none' });
    expect(resolveControl(el('button', {}, quiet) as any)).toBeNull();
    expect(resolveControl(el('input', { type: 'text' }) as any)).toBeNull();
    expect(resolveControl(el('input', { type: 'checkbox' }) as any)).not.toBeNull();
    expect(CONTROL_SELECTOR).toContain('summary');
  });

  it('reads the meaning of an activation before the app reacts', () => {
    expect(activationEvent(el('button') as any)).toBe('control.activate');
    expect(activationEvent(el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'false' }) as any)).toBe('menu.open');
    expect(activationEvent(el('button', { 'aria-haspopup': 'listbox', 'aria-expanded': 'true' }) as any)).toBe('menu.close');
    expect(activationEvent(el('button', { 'aria-expanded': 'false' }) as any)).toBe('panel.expand');
    expect(activationEvent(el('button', { 'aria-expanded': 'true' }) as any)).toBe('panel.collapse');
    expect(activationEvent(el('button', { 'data-sfx': 'task.complete' }) as any)).toBe('task.complete');
    expect(activationEvent(el('button', { 'data-sfx': 'not.an.event' }) as any)).toBe('control.activate');
    const details = el('details');
    const summary = el('summary', {}, details);
    expect(activationEvent(summary as any)).toBe('panel.expand');
    details.open = true;
    expect(activationEvent(summary as any)).toBe('panel.collapse');
  });
});

describe('gesture arbitration', () => {
  function arbiter() {
    const played: string[] = [];
    return { played, arb: new GestureArbiter({ play: event => { played.push(event); } }) };
  }
  const base = { candidate: null, primary: false, silenced: false, dialogs: [], menus: [] };

  it('plays one ordinary cue per activation', () => {
    const { played, arb } = arbiter();
    arb.begin({ ...base, candidate: 'control.activate' });
    arb.finish();
    arb.finish();
    expect(played).toEqual(['control.activate']);
  });

  it('lets an app success event replace the click of the same gesture', () => {
    const { played, arb } = arbiter();
    arb.begin({ ...base, candidate: 'control.activate' });
    arb.emit('task.complete');
    arb.finish();
    expect(played).toEqual(['task.complete']);
  });

  it('plays a dismissed dialog as modal.close once, but a primary confirmation as activation', () => {
    const dialog = el('div', { role: 'dialog' });
    const one = arbiter();
    one.arb.begin({ ...base, candidate: 'control.activate', dialogs: [dialog as any] });
    dialog.isConnected = false;
    one.arb.finish();
    expect(one.played).toEqual(['modal.close']);

    const other = el('div', { role: 'dialog' });
    const two = arbiter();
    two.arb.begin({ ...base, candidate: 'control.activate', primary: true, dialogs: [other as any] });
    other.isConnected = false;
    two.arb.finish();
    expect(two.played).toEqual(['control.activate']);
  });

  it('plays menu.close when Escape closed a popup, and nothing when nothing changed', () => {
    const trigger = el('button', { 'aria-haspopup': 'menu', 'aria-expanded': 'true' });
    const { played, arb } = arbiter();
    arb.begin({ ...base, menus: [trigger as any] });
    trigger.setAttribute('aria-expanded', 'false');
    arb.finish();
    arb.begin({ ...base });
    arb.finish();
    expect(played).toEqual(['menu.close']);
  });

  it('silences inferred cues in data-sfx="none" areas but keeps app events', () => {
    const { played, arb } = arbiter();
    arb.begin({ ...base, silenced: true });
    arb.finish();
    arb.begin({ ...base, silenced: true });
    arb.emit('save.success');
    arb.finish();
    expect(played).toEqual(['save.success']);
  });

  it('plays an event emitted outside a gesture immediately (async server success)', () => {
    const { played, arb } = arbiter();
    arb.emit('save.success');
    expect(played).toEqual(['save.success']);
  });
});

describe('delegated listeners', () => {
  function harness({ hoverCapable = true } = {}) {
    const listeners = new Map<string, Set<(event: any) => void>>();
    const target = {
      addEventListener: (type: string, fn: any) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(fn); },
      removeEventListener: (type: string, fn: any) => { listeners.get(type)?.delete(fn); },
    };
    const dialogs: FakeEl[] = [];
    const doc = { ...target, querySelectorAll: (selector: string) => (selector.includes('dialog') ? dialogs.filter(d => d.isConnected) : []) };
    const win = {
      ...target,
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: any) => clearTimeout(id),
      matchMedia: () => ({ matches: hoverCapable }),
    };
    const played: string[] = [];
    const hovered: string[] = [];
    const clock = { t: 10_000, lastActivation: -Infinity };
    const arb = new GestureArbiter({ play: event => { played.push(event); clock.lastActivation = clock.t; } });
    const unlock = vi.fn();
    const dispose = installSoundGestures({
      doc: doc as any, win: win as any, arbiter: arb, unlock,
      playHover: event => { hovered.push(event); }, now: () => clock.t, lastActivationAt: () => clock.lastActivation,
    });
    let x = 0;
    const fire = (type: string, event: any) => {
      /* boundary events carry the pointer position; a still cursor repeats it */
      if (!event.still) x += 5;
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ isTrusted: true, clientX: x, clientY: 10, ...event });
    };
    const count = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
    return { fire, played, hovered, dialogs, unlock, dispose, count, clock };
  }

  it('ignores untrusted (programmatic) clicks and never unlocks audio for them', async () => {
    const h = harness();
    h.fire('click', { isTrusted: false, target: el('button') });
    await flush();
    expect(h.played).toEqual([]);
    expect(h.unlock).not.toHaveBeenCalled();
  });

  it('plays once for a pointer press + click, and once for keyboard activation', async () => {
    const h = harness();
    const button = el('button');
    h.fire('pointerdown', { target: button });
    h.fire('mousedown', { target: button });
    await flush();
    h.fire('click', { target: button, detail: 1 });
    await flush();
    h.fire('click', { target: button, detail: 0 });
    await flush();
    expect(h.played).toEqual(['control.activate', 'control.activate']);
    expect(h.unlock).toHaveBeenCalled();
  });

  it('plays modal.close once for Escape or a backdrop press that removes a dialog', async () => {
    const h = harness();
    const dialog = el('div', { role: 'dialog' });
    h.dialogs.push(dialog);
    h.fire('keydown', { key: 'Escape', repeat: false, target: dialog });
    dialog.isConnected = false;
    await flush();
    const second = el('div', { role: 'dialog' });
    h.dialogs.push(second);
    h.fire('pointerdown', { target: el('div') });
    second.isConnected = false;
    await flush();
    h.fire('keydown', { key: 'a', target: el('div') });
    await flush();
    expect(h.played).toEqual(['modal.close', 'modal.close']);
  });

  it('plays hover only for a hover-capable mouse, rate limited, never for touch', () => {
    const h = harness();
    const a = el('button');
    const b = el('button', {}, null, ['set-btn-primary']);
    h.fire('pointerover', { pointerType: 'touch', buttons: 0, target: a, relatedTarget: null });
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: a, relatedTarget: null });
    h.clock.t += 10;
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: b, relatedTarget: a });
    h.clock.t += HOVER_MIN_GAP_MS;
    h.fire('pointerout', { pointerType: 'mouse', buttons: 0, target: b, relatedTarget: null });
    h.clock.t += HOVER_MIN_GAP_MS;
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: el('span', {}, a), relatedTarget: a });
    const big = el('button'); big.rect = { width: 600, height: 200 };
    h.clock.t += HOVER_MIN_GAP_MS;
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: big, relatedTarget: null });
    expect(h.hovered).toEqual(['hover.enter', 'hover.cta.leave']);
    /* control → adjacent control: one enter cue, no leave cue competing with it */
    const moved = harness();
    moved.fire('pointerout', { pointerType: 'mouse', buttons: 0, target: a, relatedTarget: b });
    moved.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: b, relatedTarget: a });
    expect(moved.hovered).toEqual(['hover.cta.enter']);
    const touchOnly = harness({ hoverCapable: false });
    touchOnly.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: a, relatedTarget: null });
    expect(touchOnly.hovered).toEqual([]);
  });

  it('ignores boundary events without real pointer movement (layout change under a still cursor)', () => {
    const h = harness();
    h.fire('pointermove', { pointerType: 'mouse', buttons: 0, target: el('div') });
    h.clock.t += HOVER_MOVE_WINDOW_MS + 1;
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: el('button'), relatedTarget: null, still: true });
    expect(h.hovered).toEqual([]);
    /* a dialog opening over the clicked button: out event at the same position */
    const opened = harness();
    const button = el('button');
    opened.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: button, relatedTarget: null });
    opened.clock.t += HOVER_MOVE_WINDOW_MS + 300;
    opened.fire('pointerout', { pointerType: 'mouse', buttons: 0, target: button, relatedTarget: el('div'), still: true });
    expect(opened.hovered).toEqual(['hover.enter']);
  });

  it('keeps hover quiet right after a press, before any cue resolved', () => {
    const h = harness();
    const button = el('button');
    h.fire('pointerdown', { target: button });
    h.clock.t += 17;
    h.fire('pointerout', { pointerType: 'mouse', buttons: 0, target: button, relatedTarget: el('div') });
    expect(h.hovered).toEqual([]);
  });

  it('keeps hover quiet right after an activation cue', async () => {
    const h = harness();
    const button = el('button');
    h.fire('click', { target: button });
    await flush();
    h.clock.t += HOVER_AFTER_ACTIVATION_MS - 1;
    h.fire('pointerover', { pointerType: 'mouse', buttons: 0, target: el('button'), relatedTarget: button });
    expect(h.hovered).toEqual([]);
  });

  it('detaches every listener on dispose (no duplicates after a remount)', () => {
    const h = harness();
    expect(h.count()).toBeGreaterThan(0);
    h.dispose();
    expect(h.count()).toBe(0);
  });
});
