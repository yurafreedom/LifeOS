/* Gesture → sound arbitration.
 *
 * One trusted user gesture produces at most one cue. A gesture opens on a
 * trusted `click` (pointer, touch and keyboard activation all dispatch one),
 * a trusted Escape keydown, or a trusted pointer/mouse press, and resolves on
 * the next task — after React has handled the event and committed. The winner
 * is the highest-priority candidate:
 *
 *   app-emitted semantic event (task.complete, save.success)      90
 *   a dialog that was open before the gesture is gone             70 modal.close
 *   explicit `data-sfx` / menu toggle / expander toggle /
 *   a popup menu closed by Escape                                 60
 *   ordinary eligible control                                     10 control.activate
 *
 * Only eligible controls sound: buttons, links, tabs, menu items, switches,
 * options, <summary>, checkboxes and radios that are not disabled. Text,
 * cards, decoration, inputs and disabled controls stay silent, and
 * `data-sfx="none"` silences a subtree. Programmatic `.click()` / focus /
 * rendering are not trusted gestures and never sound.
 *
 * Hover cues need a real hover-capable fine pointer (never touch) that just
 * moved, fire only on entering/leaving a control-sized eligible control, are
 * rate limited, and stay quiet right after an activation cue.
 */
import { soundEvent, type SoundEventId } from './catalog';

export const CONTROL_SELECTOR = [
  'button', 'a[href]', 'summary', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
  '[role="menuitemradio"]', '[role="menuitemcheckbox"]', '[role="switch"]', '[role="option"]',
  'input[type="checkbox"]', 'input[type="radio"]',
].join(',');

/* Primary calls to action — the paradise capsule set plus submit buttons. A
   primary control closing a dialog is a confirmation, not a dismissal. */
export const CTA_SELECTOR = [
  '.qa-btn-save', '.set-btn-primary', '.money-log', '.medc-action-take', '.btn--stakes',
  '.btn--positive', 'button[type="submit"]',
].join(',');

export const HOVER_MIN_GAP_MS = 70;
export const HOVER_AFTER_ACTIVATION_MS = 250;
/* Boundary events also fire when layout changes under a still cursor (a
   dialog opening over the clicked button). Hover sounds only when the
   boundary event itself is at a new pointer position, or a pointermove at
   that position landed within the same frame. */
export const HOVER_MOVE_WINDOW_MS = 16;
const HOVER_MAX_HEIGHT = 72;
const HOVER_MAX_WIDTH = 420;

type El = Element & { disabled?: boolean };

function isDisabled(el: El): boolean {
  return !!el.disabled || el.getAttribute('aria-disabled') === 'true'
    || !!el.closest('fieldset[disabled]');
}

/** The eligible control a gesture on `target` belongs to, or null. */
export function resolveControl(target: EventTarget | null): Element | null {
  const node = target as (Element & { closest?: Element['closest'] }) | null;
  if (!node || typeof node.closest !== 'function') return null;
  if (node.closest('[data-sfx="none"]')) return null;
  const control = node.closest(CONTROL_SELECTOR) as El | null;
  if (!control || isDisabled(control)) return null;
  return control;
}

export function isCta(control: Element): boolean {
  return control.matches(CTA_SELECTOR);
}

/** The cue an activation of `control` means, read before the app reacts. */
export function activationEvent(control: Element): SoundEventId {
  const explicit = control.getAttribute('data-sfx');
  if (explicit && soundEvent(explicit)) return explicit as SoundEventId;
  const expanded = control.getAttribute('aria-expanded');
  if (expanded === 'true' || expanded === 'false') {
    const popup = control.getAttribute('aria-haspopup');
    const opening = expanded === 'false';
    if (popup && popup !== 'false' && popup !== 'dialog') return opening ? 'menu.open' : 'menu.close';
    return opening ? 'panel.expand' : 'panel.collapse';
  }
  if (control.tagName === 'SUMMARY') {
    const details = control.parentElement;
    if (details && details.tagName === 'DETAILS') {
      return (details as HTMLDetailsElement).open ? 'panel.collapse' : 'panel.expand';
    }
  }
  return 'control.activate';
}

function priority(id: SoundEventId | null): number {
  return id ? soundEvent(id)?.priority ?? 0 : -1;
}

function higher(a: SoundEventId | null, b: SoundEventId | null): SoundEventId | null {
  return priority(b) > priority(a) ? b : a;
}

interface Gesture {
  candidate: SoundEventId | null;
  primary: boolean;
  silenced: boolean;
  dialogs: Element[];
  /** Open popup triggers, watched only for Escape (outside-click dismissal is silent). */
  menus: Element[];
  claimed: SoundEventId | null;
}

export interface GestureSink {
  play(event: SoundEventId): unknown;
}

/** Collects the candidates of one gesture and plays the single winner. */
export class GestureArbiter {
  private current: Gesture | null = null;
  constructor(private sink: GestureSink) {}

  get open(): boolean { return !!this.current; }

  begin(gesture: Omit<Gesture, 'claimed'>): void {
    if (this.current) this.finish();
    this.current = { ...gesture, claimed: null };
  }

  /** An app-emitted event. Inside a gesture it competes; outside it plays now. */
  emit(event: SoundEventId): void {
    if (this.current) this.current.claimed = higher(this.current.claimed, event);
    else this.sink.play(event);
  }

  finish(): SoundEventId | null {
    const gesture = this.current;
    this.current = null;
    if (!gesture) return null;
    let winner = gesture.claimed;
    if (!gesture.silenced) {
      const dialogClosed = !gesture.primary && gesture.dialogs.some(dialog => !dialog.isConnected);
      winner = higher(winner, dialogClosed ? 'modal.close' : null);
      const menuClosed = gesture.menus.some(trigger => trigger.getAttribute('aria-expanded') !== 'true');
      winner = higher(winner, menuClosed ? 'menu.close' : null);
      winner = higher(winner, gesture.candidate);
    }
    if (winner) this.sink.play(winner);
    return winner;
  }
}

export interface InstallOptions {
  doc: Document;
  win: Window;
  arbiter: GestureArbiter;
  unlock(): void;
  playHover(event: SoundEventId): void;
  now(): number;
  lastActivationAt(): number;
}

/** Hover-capable fine pointer (mouse / trackpad) — never touch-only devices. */
export function hoverCapable(win: Window): boolean {
  try {
    return !!win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

function hoverControl(target: EventTarget | null): Element | null {
  const control = resolveControl(target);
  if (!control || control.closest('[data-sfx-hover="none"]')) return null;
  const rect = control.getBoundingClientRect();
  if (rect.height > HOVER_MAX_HEIGHT || rect.width > HOVER_MAX_WIDTH) return null;
  return control;
}

/** Attach the delegated listeners. Returns the detach function. */
export function installSoundGestures(options: InstallOptions): () => void {
  const { doc, win, arbiter } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastHoverAt = -Infinity;
  let lastMoveAt = -Infinity;
  let lastPressAt = -Infinity;
  let lastX = NaN;
  let lastY = NaN;

  function openDialogs(): Element[] {
    return Array.from(doc.querySelectorAll('[role="dialog"]'));
  }
  function schedule() {
    if (timer !== null) return;
    timer = win.setTimeout(() => { timer = null; arbiter.finish(); }, 0);
  }
  function begin(candidate: SoundEventId | null, control: Element | null, silenced = false, escape = false) {
    const menus = escape ? Array.from(doc.querySelectorAll('[aria-haspopup][aria-expanded="true"]')) : [];
    arbiter.begin({ candidate, primary: !!control && isCta(control), silenced, dialogs: openDialogs(), menus });
    schedule();
  }

  function onPress(event: Event) {
    if (!event.isTrusted) return;
    lastPressAt = options.now();
    options.unlock();
    if (arbiter.open) return;
    /* A press can dismiss a dialog through its backdrop; it never plays a
       control cue itself — the following click does. */
    const target = event.target as Element | null;
    begin(null, null, !!(target && target.closest && target.closest('[data-sfx="none"]')));
  }
  function onClick(event: MouseEvent) {
    if (!event.isTrusted) return;
    lastPressAt = options.now();
    options.unlock();
    const target = event.target as Element | null;
    const silenced = !!(target && target.closest && target.closest('[data-sfx="none"]'));
    const control = resolveControl(target);
    begin(control ? activationEvent(control) : null, control, silenced);
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!event.isTrusted) return;
    options.unlock();
    if (event.key !== 'Escape' || event.repeat) return;
    begin(null, null, false, true);
  }
  /* Browsers dispatch boundary events before the pointermove of the same
     motion, so a boundary event at a new position counts as movement too. */
  function track(event: PointerEvent): boolean {
    if (!event.isTrusted || event.pointerType !== 'mouse') return false;
    if (event.clientX === lastX && event.clientY === lastY) return false;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveAt = options.now();
    return true;
  }
  function onMove(event: PointerEvent) { track(event); }
  function moving(event: PointerEvent): boolean {
    return track(event) || options.now() - lastMoveAt <= HOVER_MOVE_WINDOW_MS;
  }
  function onOver(event: PointerEvent) {
    if (!moving(event) || !event.isTrusted || event.pointerType !== 'mouse' || event.buttons) return;
    const control = hoverControl(event.target);
    if (!control || control === hoverControl(event.relatedTarget)) return;
    hover(isCta(control) ? 'hover.cta.enter' : 'hover.enter');
  }
  function onOut(event: PointerEvent) {
    if (!moving(event) || !event.isTrusted || event.pointerType !== 'mouse' || event.buttons) return;
    const control = hoverControl(event.target);
    /* Moving straight into another control voices only its enter cue. */
    if (!control || hoverControl(event.relatedTarget)) return;
    hover(isCta(control) ? 'hover.cta.leave' : 'hover.leave');
  }
  function hover(event: SoundEventId) {
    const now = options.now();
    if (!hoverCapable(win)) return;
    if (now - lastHoverAt < HOVER_MIN_GAP_MS) return;
    /* A press re-renders under the cursor (dialogs, menus): stay quiet until
       the pointer genuinely moves on, whether or not a cue has started yet. */
    if (now - Math.max(options.lastActivationAt(), lastPressAt) < HOVER_AFTER_ACTIVATION_MS) return;
    lastHoverAt = now;
    options.playHover(event);
  }

  win.addEventListener('pointerdown', onPress, true);
  win.addEventListener('mousedown', onPress, true);
  win.addEventListener('touchend', onPress, true);
  win.addEventListener('click', onClick, true);
  win.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('pointermove', onMove, true);
  doc.addEventListener('pointerover', onOver, true);
  doc.addEventListener('pointerout', onOut, true);
  return () => {
    win.removeEventListener('pointerdown', onPress, true);
    win.removeEventListener('mousedown', onPress, true);
    win.removeEventListener('touchend', onPress, true);
    win.removeEventListener('click', onClick, true);
    win.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerover', onOver, true);
    doc.removeEventListener('pointerout', onOut, true);
    if (timer !== null) { win.clearTimeout(timer); timer = null; }
    arbiter.finish();
  };
}
