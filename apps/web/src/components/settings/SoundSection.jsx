import React from 'react';
import { useSoundPreferences } from '../../app/useUiSound.js';
import {
  SOUND_ASSETS,
  SOUND_EVENTS,
  defaultSoundPreferences,
  sfx,
  soundAsset,
} from '../../sound';
import { LIcons } from '../icons.jsx';
import { useDialog } from '../useDialog.js';
import { Row } from './Row.jsx';

const { useEffect, useRef, useState } = React;

/*
 * Settings · «Звуковые эффекты».
 *
 * The configuration controls are `data-sfx="none"`: toggling, previewing or
 * assigning never plays the ordinary UI cue on top of the preview. The test
 * bench below them is ordinary UI and goes through the real gesture pipeline.
 * Technical clip data (file, duration, sprite range) lives only here.
 */

export function eventLabelKey(eventId) {
  return 'sfx_ev_' + eventId.replace(/\./g, '_');
}

function formatSeconds(value, t) {
  const text = new Intl.NumberFormat(t('_intl_locale'), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value);
  return t('sfx_seconds', text);
}

/** Candidate metadata line: duration, then origin (file or sprite range). */
export function assetMeta(asset, t) {
  const duration = formatSeconds(asset.end - asset.start, t);
  if (!asset.source) return `${duration} · ${t('sfx_source_file')}`;
  const fmt = n => new Intl.NumberFormat(t('_intl_locale'), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${duration} · ${t('sfx_source_segment', asset.source.file, fmt(asset.source.from), fmt(asset.source.to), asset.source.nearest)}`;
}

function PlayGlyph({ playing }) {
  return playing
    ? <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor"/></svg>
    : <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 2.2v7.6L9.8 6z" fill="currentColor"/></svg>;
}

function SoundSection({ t }) {
  const [prefs, setPrefs] = useSoundPreferences();
  const [selected, setSelected] = useState(SOUND_EVENTS[0].id);
  const [playing, setPlaying] = useState(null);
  const playTimer = useRef(null);

  useEffect(() => () => { clearTimeout(playTimer.current); sfx.stopPreview(); }, []);

  const update = patch => setPrefs({ ...prefs, ...patch });
  const assign = (eventId, assetId) => update({ assignments: { ...prefs.assignments, [eventId]: assetId } });

  function preview(assetId) {
    clearTimeout(playTimer.current);
    if (!assetId || playing === assetId) {
      sfx.stopPreview();
      setPlaying(null);
      return;
    }
    const asset = soundAsset(assetId);
    if (!asset || !sfx.preview(assetId)) return;
    setPlaying(assetId);
    playTimer.current = setTimeout(() => setPlaying(null), (asset.end - asset.start) * 1000 + 150);
  }

  const volumePct = Math.round(prefs.volume * 100);
  const selectedLabel = t(eventLabelKey(selected));
  const current = prefs.assignments[selected] ?? null;

  return (
    <div className="set-sfx">
      <div data-sfx="none">
        <Row label={t('sfx_enabled')} hint={t('sfx_enabled_hint')}>
          <button type="button" role="switch" aria-checked={prefs.enabled} aria-label={t('sfx_enabled')}
                  className={'set-toggle' + (prefs.enabled ? ' is-on' : '')}
                  onClick={() => update({ enabled: !prefs.enabled })}>
            <span className="set-toggle-knob"/>
          </button>
        </Row>
        <Row label={t('sfx_volume')} hint={volumePct + '%'}>
          <input type="range" className="set-range" min="0" max="100" step="1" value={volumePct}
                 aria-label={t('sfx_volume')} aria-valuetext={volumePct + '%'}
                 onChange={event => update({ volume: Number(event.target.value) / 100 })}/>
        </Row>
        <Row label={t('sfx_hover')} hint={t('sfx_hover_hint')}>
          <button type="button" role="switch" aria-checked={prefs.hover} aria-label={t('sfx_hover')}
                  className={'set-toggle' + (prefs.hover ? ' is-on' : '')}
                  onClick={() => update({ hover: !prefs.hover })}>
            <span className="set-toggle-knob"/>
          </button>
        </Row>

        <h3 className="set-ret-sub">{t('sfx_assign_h')}</h3>
        <p className="set-sfx-help">{t('sfx_assign_help')}</p>

        <div className="set-sfx-grid">
          <div className="set-sfx-events" role="radiogroup" aria-label={t('sfx_events_label')}>
            {SOUND_EVENTS.map(event => {
              const assetId = prefs.assignments[event.id];
              const asset = soundAsset(assetId);
              const on = selected === event.id;
              return (
                <button key={event.id} type="button" role="radio" aria-checked={on}
                        className={'set-sfx-event' + (on ? ' is-on' : '')}
                        onClick={() => setSelected(event.id)}>
                  <span className="set-sfx-event-name">{t(eventLabelKey(event.id))}</span>
                  <span className="set-sfx-event-asset mono">{asset ? asset.file : t('sfx_none')}</span>
                </button>
              );
            })}
          </div>

          <div className="set-sfx-cands" role="group" aria-label={t('sfx_candidates_label', selectedLabel)}>
            <div className="set-sfx-cands-h mono">{t('sfx_candidates_label', selectedLabel)}</div>
            {(selected === 'task.complete' || selected === 'save.success') &&
              <p className="set-sfx-note">{t(eventLabelKey(selected) + '_hint')}</p>}
            <div className={'set-sfx-cand' + (current === null ? ' is-on' : '')}>
              <span className="set-sfx-play is-empty" aria-hidden="true"/>
              <span className="set-sfx-cand-main"><span className="set-sfx-cand-file">{t('sfx_none')}</span></span>
              {current === null
                ? <span className="set-sfx-badge mono">{t('sfx_assigned')}</span>
                : <button type="button" className="set-btn-ghost set-sfx-assign" onClick={() => assign(selected, null)}>{t('sfx_assign')}</button>}
            </div>
            {SOUND_ASSETS.map(asset => {
              const isPlaying = playing === asset.id;
              const on = current === asset.id;
              return (
                <div key={asset.id} className={'set-sfx-cand' + (on ? ' is-on' : '')}>
                  <button type="button" className={'set-sfx-play' + (isPlaying ? ' is-playing' : '')}
                          aria-label={t(isPlaying ? 'sfx_stop_aria' : 'sfx_preview_aria', asset.file)}
                          onClick={() => preview(asset.id)}>
                    <PlayGlyph playing={isPlaying}/>
                  </button>
                  <span className="set-sfx-cand-main">
                    <span className="set-sfx-cand-file mono">{asset.file}</span>
                    <span className="set-sfx-cand-meta mono">{assetMeta(asset, t)}</span>
                  </span>
                  {on
                    ? <span className="set-sfx-badge mono">{t('sfx_assigned')}</span>
                    : <button type="button" className="set-btn-ghost set-sfx-assign" onClick={() => assign(selected, asset.id)}>{t('sfx_assign')}</button>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="set-sfx-actions">
          <button type="button" className="set-btn-ghost"
                  onClick={() => { sfx.stopPreview(); setPlaying(null); setPrefs(defaultSoundPreferences()); }}>
            {t('sfx_reset')}
          </button>
        </div>
      </div>

      <SoundBench t={t} enabled={prefs.enabled}/>
    </div>
  );
}

/* Representative interactions that go through the real sound pipeline. */
function SoundBench({ t, enabled }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <section className="set-sfx-bench" aria-labelledby="set-sfx-bench-h">
      <h3 className="set-ret-sub" id="set-sfx-bench-h">{t('sfx_bench_h')}</h3>
      <p className="set-sfx-help">{enabled ? t('sfx_bench_help') : t('sfx_bench_off')}</p>
      <div className="set-sfx-bench-row">
        <button type="button" className="set-btn-ghost">{t('sfx_bench_button')}</button>
        <button type="button" className="set-btn-primary">{t('sfx_bench_cta')}</button>
        <span className="set-sfx-menu">
          <button type="button" className="set-btn-ghost" aria-haspopup="menu" aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(open => !open)}>{t('sfx_bench_menu')} ▾</button>
          {menuOpen && (
            <span className="set-sfx-menu-pop" role="menu"
                  onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false); }}>
              {[1, 2].map(n => (
                <button key={n} type="button" role="menuitem" className="set-sfx-menu-item"
                        onClick={() => setMenuOpen(false)}>{t('sfx_bench_menu_item', n)}</button>
              ))}
            </span>
          )}
        </span>
        <button type="button" className="set-btn-ghost" onClick={() => setDialogOpen(true)}>{t('sfx_bench_dialog')}</button>
        <button type="button" className="set-btn-ghost" data-sfx="task.complete">{t('sfx_bench_task')}</button>
        <button type="button" className="set-btn-ghost" data-sfx="save.success">{t('sfx_bench_save')}</button>
      </div>
      <details className="set-sfx-details">
        <summary>{t('sfx_bench_panel')}</summary>
        <p>{t('sfx_bench_panel_body')}</p>
      </details>
      {dialogOpen && <SoundBenchDialog t={t} onClose={() => setDialogOpen(false)}/>}
    </section>
  );
}

function SoundBenchDialog({ t, onClose }) {
  const dialogRef = useRef(null);
  useDialog(dialogRef, { onClose });
  return (
    <div className="set-sfx-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="set-sfx-dialog" role="dialog" aria-modal="true" aria-labelledby="set-sfx-dialog-h" ref={dialogRef}>
        <div className="set-sfx-dialog-head">
          <h3 className="set-ret-sub" id="set-sfx-dialog-h">{t('sfx_bench_dialog_title')}</h3>
          <button type="button" className="qa-close" aria-label={t('sfx_bench_close')} onClick={onClose}><LIcons.x size={14}/></button>
        </div>
        <p className="set-sfx-help">{t('sfx_bench_dialog_body')}</p>
        <div className="set-sfx-actions">
          <button type="button" className="set-btn-ghost" onClick={onClose}>{t('sfx_bench_close')}</button>
        </div>
      </div>
    </div>
  );
}

export { SoundSection };
