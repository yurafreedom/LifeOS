/* UI sound catalog — every runtime clip and every semantic sound event.
 *
 * Assets are bundled from src/assets/sfx (Vite fingerprints them and resolves
 * the configured base path). Importing a URL loads nothing: a clip is fetched
 * and decoded only when an assigned event or a preview first needs it.
 *
 * `start`/`end` bound playback inside the decoded buffer (seconds), cutting
 * digital silence and the neighbouring gaps of the sprite-derived clips.
 * `gainDb` is a measured loudness trim toward ≈ −30 dBFS active RMS (±12 dB,
 * peak kept ≤ −3 dBFS). Numbers come from signal analysis with ffmpeg + numpy
 * (see Outputs/Implementations/lifeos-ui-sound-effects_*.md), not listening.
 */
import click from '../assets/sfx/click.mp3';
import closeWindow from '../assets/sfx/close_window.mp3';
import decoding from '../assets/sfx/decoding.mp3';
import expand from '../assets/sfx/expand.mp3';
import hoverCtaIn from '../assets/sfx/hover_cta_in.mp3';
import hoverCtaOut from '../assets/sfx/hover_cta_out.mp3';
import hoverUiIn from '../assets/sfx/hover_ui_in.mp3';
import hoverUiOut from '../assets/sfx/hover_ui_out.mp3';
import menuIn from '../assets/sfx/menu_in.mp3';
import menuOut from '../assets/sfx/menu_out.mp3';
import quickBuildup from '../assets/sfx/quick_buildup.mp3';
import release from '../assets/sfx/release.mp3';
import seg01 from '../assets/sfx/sfx_seg01.mp3';
import seg03 from '../assets/sfx/sfx_seg03.mp3';
import seg07 from '../assets/sfx/sfx_seg07.mp3';
import seg08 from '../assets/sfx/sfx_seg08.mp3';
import seg12 from '../assets/sfx/sfx_seg12.mp3';

export interface SoundAsset {
  id: string;
  file: string;
  url: string;
  start: number;
  end: number;
  gainDb: number;
  /** Set for clips cut from sfx.mp3: range inside the original sprite. */
  source?: { file: 'sfx.mp3'; from: number; to: number; nearest: string };
}

export const SOUND_ASSETS: readonly SoundAsset[] = [
  { id: 'click', file: 'click.mp3', url: click, start: 0, end: 0.234, gainDb: 12 },
  { id: 'close_window', file: 'close_window.mp3', url: closeWindow, start: 0, end: 0.301, gainDb: -3.6 },
  { id: 'decoding', file: 'decoding.mp3', url: decoding, start: 0, end: 0.589, gainDb: 10.1 },
  { id: 'expand', file: 'expand.mp3', url: expand, start: 0.013, end: 4.256, gainDb: -12 },
  { id: 'hover_cta_in', file: 'hover_cta_in.mp3', url: hoverCtaIn, start: 0.009, end: 0.871, gainDb: -0.9 },
  { id: 'hover_cta_out', file: 'hover_cta_out.mp3', url: hoverCtaOut, start: 0.011, end: 0.876, gainDb: -0.8 },
  { id: 'hover_ui_in', file: 'hover_ui_in.mp3', url: hoverUiIn, start: 0.011, end: 0.066, gainDb: 12 },
  { id: 'hover_ui_out', file: 'hover_ui_out.mp3', url: hoverUiOut, start: 0, end: 0.04, gainDb: 12 },
  { id: 'menu_in', file: 'menu_in.mp3', url: menuIn, start: 0.021, end: 1.736, gainDb: -10.3 },
  { id: 'menu_out', file: 'menu_out.mp3', url: menuOut, start: 0.041, end: 2.235, gainDb: -9.6 },
  { id: 'quick_buildup', file: 'quick_buildup.mp3', url: quickBuildup, start: 0.015, end: 0.51, gainDb: 8 },
  { id: 'release', file: 'release.mp3', url: release, start: 0, end: 2.328, gainDb: -0.7 },
  { id: 'sfx_seg01', file: 'sfx_seg01.mp3', url: seg01, start: 0, end: 0.247, gainDb: 10.5,
    source: { file: 'sfx.mp3', from: 0, to: 0.247, nearest: 'click.mp3' } },
  { id: 'sfx_seg03', file: 'sfx_seg03.mp3', url: seg03, start: 0.491, end: 1.123, gainDb: 6.5,
    source: { file: 'sfx.mp3', from: 4.997, to: 5.629, nearest: 'decoding.mp3' } },
  { id: 'sfx_seg07', file: 'sfx_seg07.mp3', url: seg07, start: 0.492, end: 0.606, gainDb: 12,
    source: { file: 'sfx.mp3', from: 16.988, to: 17.102, nearest: 'hover_ui_in.mp3' } },
  { id: 'sfx_seg08', file: 'sfx_seg08.mp3', url: seg08, start: 0.478, end: 0.589, gainDb: 12,
    source: { file: 'sfx.mp3', from: 18.986, to: 19.097, nearest: 'hover_ui_out.mp3' } },
  { id: 'sfx_seg12', file: 'sfx_seg12.mp3', url: seg12, start: 0.485, end: 2.517, gainDb: -2.8,
    source: { file: 'sfx.mp3', from: 29.99, to: 32.022, nearest: 'release.mp3' } },
];

const ASSET_BY_ID = new Map(SOUND_ASSETS.map(asset => [asset.id, asset]));

export function soundAsset(id: string | null | undefined): SoundAsset | undefined {
  return id ? ASSET_BY_ID.get(id) : undefined;
}

/* Channels bound polyphony: a new cue on a channel fades out the previous
   one, so rapid repeats never stack. */
export type SoundChannel = 'ui' | 'menu' | 'panel' | 'modal' | 'hover' | 'status' | 'preview';

export interface SoundEvent {
  id: SoundEventId;
  channel: SoundChannel;
  /** Higher wins when one gesture produces several candidate cues. */
  priority: number;
  hover: boolean;
  defaultAsset: string | null;
}

export type SoundEventId =
  | 'control.activate' | 'menu.open' | 'menu.close' | 'panel.expand' | 'panel.collapse'
  | 'modal.close' | 'hover.enter' | 'hover.leave' | 'hover.cta.enter' | 'hover.cta.leave'
  | 'task.complete' | 'save.success';

/* Default assignments: filename-based for the named clips; task.complete and
   save.success are measured-shape hypotheses (immediate attack, short decay)
   for the owner to confirm by ear. quick_buildup and the sfx.mp3 variants are
   left unassigned. */
export const SOUND_EVENTS: readonly SoundEvent[] = [
  { id: 'control.activate', channel: 'ui', priority: 10, hover: false, defaultAsset: 'click' },
  { id: 'menu.open', channel: 'menu', priority: 60, hover: false, defaultAsset: 'menu_in' },
  { id: 'menu.close', channel: 'menu', priority: 60, hover: false, defaultAsset: 'menu_out' },
  { id: 'panel.expand', channel: 'panel', priority: 60, hover: false, defaultAsset: 'expand' },
  { id: 'panel.collapse', channel: 'panel', priority: 60, hover: false, defaultAsset: null },
  { id: 'modal.close', channel: 'modal', priority: 70, hover: false, defaultAsset: 'close_window' },
  { id: 'hover.enter', channel: 'hover', priority: 1, hover: true, defaultAsset: 'hover_ui_in' },
  { id: 'hover.leave', channel: 'hover', priority: 1, hover: true, defaultAsset: 'hover_ui_out' },
  { id: 'hover.cta.enter', channel: 'hover', priority: 1, hover: true, defaultAsset: 'hover_cta_in' },
  { id: 'hover.cta.leave', channel: 'hover', priority: 1, hover: true, defaultAsset: 'hover_cta_out' },
  { id: 'task.complete', channel: 'status', priority: 90, hover: false, defaultAsset: 'release' },
  { id: 'save.success', channel: 'status', priority: 90, hover: false, defaultAsset: 'decoding' },
];

const EVENT_BY_ID = new Map<string, SoundEvent>(SOUND_EVENTS.map(event => [event.id, event]));

export function soundEvent(id: string | null | undefined): SoundEvent | undefined {
  return id ? EVENT_BY_ID.get(id) : undefined;
}
