import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SoundSection, assetMeta, eventLabelKey } from '../components/settings/SoundSection.jsx';
import { savePolicy } from '../components/settings/RetentionSection.jsx';
import { completesTask } from '../context/LifeDataContext.jsx';
import { LifeLocales, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import { SOUND_ASSETS, SOUND_EVENTS, soundAsset } from '../sound';

/* Settings · sound effects, and the success boundaries that emit cues. */

describe('Settings · sound effects section', () => {
  it.each(LifeLocales)('renders controls, every event and every candidate (%s)', locale => {
    const t = LifeMakeT(locale);
    const html = renderToStaticMarkup(<SoundSection t={t} />);
    expect(html).toContain(t('sfx_enabled'));
    expect(html).toContain(t('sfx_volume'));
    expect(html).toContain('value="25"');
    expect(html).toContain(t('sfx_hover'));
    expect(html).toContain(t('sfx_reset'));
    for (const event of SOUND_EVENTS) expect(html).toContain(t(eventLabelKey(event.id)));
    for (const asset of SOUND_ASSETS) expect(html).toContain(asset.file);
    expect(html).not.toContain('sfx.mp3</span>');
    /* configuration controls never play the ordinary click over a preview */
    expect(html).toMatch(/<div data-sfx="none">/);
    expect(html).toContain('data-sfx="task.complete"');
  });

  it('has every sound string in both locales', () => {
    const keys = Object.keys(LifeStrings.ru).filter(key => key.startsWith('sfx_') || key === 'set_sound');
    expect(keys.length).toBeGreaterThan(40);
    for (const key of keys) expect(typeof LifeStrings.uk[key]).toBe('string');
    for (const event of SOUND_EVENTS) {
      expect(LifeStrings.ru[eventLabelKey(event.id)]).toBeTruthy();
      expect(LifeStrings.uk[eventLabelKey(event.id)]).toBeTruthy();
    }
  });

  it('shows duration and sprite origin for derived clips', () => {
    const t = LifeMakeT('ru');
    expect(assetMeta(soundAsset('click'), t)).toBe('0,23 с · отдельный файл');
    expect(assetMeta(soundAsset('sfx_seg03'), t)).toBe('0,63 с · из sfx.mp3, 5,00–5,63 с · похож на decoding.mp3');
  });
});

describe('sound success boundaries', () => {
  it('cues task completion only for an open → done local transition', () => {
    const tasks = [{ id: 1, done: false }, { id: 2, done: true }];
    expect(completesTask(tasks, 1)).toBe(true);
    expect(completesTask(tasks, '1')).toBe(true);
    expect(completesTask(tasks, 2)).toBe(false);
    expect(completesTask(tasks, 3)).toBe(false);
    expect(completesTask(null, 1)).toBe(false);
  });

  it('cues save.success only after the server acknowledged the policy PUT', async () => {
    const cue = vi.fn();
    let acknowledge;
    const client = { putRetentionPolicy: vi.fn(() => new Promise(resolve => { acknowledge = resolve; })) };
    const pending = savePolicy(client, { mode: 'unlimited' }, cue);
    await Promise.resolve();
    expect(cue).not.toHaveBeenCalled();
    acknowledge({ mode: 'unlimited' });
    await expect(pending).resolves.toEqual({ mode: 'unlimited' });
    expect(cue).toHaveBeenCalledWith('save.success');

    const failing = vi.fn();
    await expect(savePolicy({ putRetentionPolicy: () => Promise.reject(new Error('500')) }, {}, failing)).rejects.toThrow('500');
    expect(failing).not.toHaveBeenCalled();
  });
});
