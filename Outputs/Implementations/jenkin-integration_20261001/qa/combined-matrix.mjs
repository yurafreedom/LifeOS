// Combined JENKIN matrix: Current / DejaVu Sans × RU / UK × dark / light /
// paradise-day / paradise-night × 1440 / 1024 / 768 / 390 / 320, on the
// production preview against the real API (lifeos_test).
// Per configuration: Tasks (filter counts, 13 px rows, long Cyrillic title,
// account block), the Editorial logo (geometry + ink) and collapsed sidebar or
// the mobile nav, Settings → Appearance (font control + preview), and the
// Calendar in layouts B and A at every level (stage size, overflow, ≥ 12 px).
import { writeFileSync } from 'node:fs';
import { authContext, gotoApp, launch, SCR } from './lib.mjs';
import { LONG_TITLE } from './seed.mjs';

const WIDTHS = [1440, 1024, 768, 390, 320];
const THEMES = [['dark', null], ['light', null], ['paradise', 'day'], ['paradise', 'night']];
const LOCALES = ['ru', 'uk'];
const FONTS = ['current', 'dejavu'];
const LEVELS = ['#/calendar/years', '#/calendar/2026', '#/calendar/2026-10', '#/calendar/2026-08', '#/calendar/2026-10-01', '#/calendar/history'];
const SYNC = { ru: 'сохранено на сервере', uk: 'збережено на сервері' };
const INK = { dark: 'rgb(246, 239, 228)', light: 'rgb(37, 42, 43)', 'paradise-day': 'rgb(37, 42, 43)', 'paradise-night': 'rgb(246, 239, 228)' };
const [only = ''] = process.argv.slice(2);

const browser = await launch();
const rows = [];
const logo = {}; // theme → wordmark geometry per font, to prove the font never changes the logo
for (const width of WIDTHS) {
  for (const [theme, scene] of THEMES) {
    for (const locale of LOCALES) {
      for (const font of FONTS) {
        const themeName = scene ? `${theme}-${scene}` : theme;
        const tag = `${font} ${locale} ${themeName} ${width}`;
        if (only && !tag.includes(only)) continue;
        const context = await authContext(browser, { width, height: 900, theme, scene, font });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        const row = { tag, width, theme: themeName, locale, font, fails: [], stage: {} };
        const fail = (what, detail) => row.fails.push(detail === undefined ? what : `${what}: ${JSON.stringify(detail).slice(0, 240)}`);
        try {
          await gotoApp(page, '#/tasks', { locale });
          await page.waitForSelector('.tasks-filter-select');
          await page.evaluate(() => document.fonts.ready);
          const tasks = await page.evaluate(long => {
            const d = document.documentElement;
            const cs = el => el && getComputedStyle(el);
            const opts = [...document.querySelectorAll('.tasks-filter-select option')].map(o => o.textContent);
            const title = document.querySelector('.tasks-page .task-title-btn');
            const due = document.querySelector('.tasks-page .task-due');
            const longBtn = [...document.querySelectorAll('.tasks-page .task-title-btn')].find(b => b.textContent.trim() === long);
            const email = document.querySelector('.sb-foot-name');
            const sync = document.querySelector('.sb-sync-text');
            const sbVisible = email && email.offsetParent !== null;
            const wm = document.querySelector('.sb-logo .jenkin-wordmark');
            const wmBox = wm && wm.getBoundingClientRect();
            return {
              overflow: d.scrollWidth - d.clientWidth, dataFont: d.getAttribute('data-font'), opts,
              title: title && cs(title).fontSize, due: due && cs(due).fontSize,
              long: longBtn ? { right: Math.round(longBtn.getBoundingClientRect().right), vw: window.innerWidth, lines: Math.round(longBtn.getBoundingClientRect().height / parseFloat(cs(longBtn).lineHeight)) } : null,
              email: sbVisible ? { size: cs(email).fontSize, clipped: email.scrollWidth > email.clientWidth + 1 } : null,
              sync: sbVisible ? { size: cs(sync).fontSize, text: sync.textContent } : null,
              wordmark: wm && wm.offsetParent !== null ? { w: Math.round(wmBox.width * 10) / 10, h: Math.round(wmBox.height * 10) / 10, color: cs(wm).color, paths: wm.querySelectorAll('path').length, text: wm.querySelectorAll('text').length } : null,
              mnav: (() => { const n = document.querySelector('.mnav'); if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display !== 'none' && r.height > 0 && r.bottom <= window.innerHeight + 1 ? { labels: n.querySelectorAll('.mnav-label').length, h: Math.round(r.height) } : null; })(),
              docTitle: document.title,
            };
          }, LONG_TITLE);
          row.tasks = tasks;
          if (tasks.overflow !== 0) fail('tasks overflow', tasks.overflow);
          if ((font === 'dejavu') !== (tasks.dataFont === 'dejavu')) fail('data-font', tasks.dataFont);
          if (tasks.opts.length !== 7 || !tasks.opts.every(o => / · \d+$/.test(o))) fail('filter options', tasks.opts);
          if (tasks.title !== '13px' || tasks.due !== '13px') fail('task type size', [tasks.title, tasks.due]);
          if (!tasks.long || tasks.long.right > tasks.long.vw) fail('long Cyrillic title', tasks.long);
          if (tasks.docTitle !== 'JENKIN') fail('document title', tasks.docTitle);
          if (width >= 641) {
            if (!tasks.email || parseFloat(tasks.email.size) < 12 || tasks.email.clipped) fail('email', tasks.email);
            if (!tasks.sync || parseFloat(tasks.sync.size) < 12 || tasks.sync.text !== SYNC[locale]) fail('sync line', tasks.sync);
            if (!tasks.wordmark || tasks.wordmark.paths !== 6 || tasks.wordmark.text !== 0 || tasks.wordmark.color !== INK[themeName]) fail('wordmark', tasks.wordmark);
            else (logo[themeName] = logo[themeName] || {})[`${font}-${width}`] = `${tasks.wordmark.w}x${tasks.wordmark.h}`;
            /* collapsed sidebar: the serif J mark, no account block */
            await page.locator('.sb-toggle').click();
            await page.waitForTimeout(250);
            const collapsed = await page.evaluate(() => {
              const mark = document.querySelector('.sb.is-collapsed .sb-logo .jenkin-mark');
              const r = mark && mark.getBoundingClientRect();
              return { mark: mark ? { h: Math.round(r.height), color: getComputedStyle(mark).color, point: !!mark.querySelector('.jenkin-mark-point') } : null,
                account: !!document.querySelector('.sb.is-collapsed .sb-foot-name'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
            });
            row.collapsed = collapsed;
            if (!collapsed.mark || collapsed.mark.h !== 22 || !collapsed.mark.point || collapsed.mark.color !== INK[themeName] || collapsed.account || collapsed.overflow !== 0) fail('collapsed sidebar', collapsed);
            await page.locator('.sb-toggle').click();
            await page.waitForTimeout(250);
          } else if (!tasks.mnav || tasks.mnav.labels < 4) fail('mobile nav missing', tasks.mnav);

          /* Settings → Appearance: font control, localized preview */
          await page.evaluate(() => { location.hash = '#/settings'; });
          const nav = page.locator('.set-nav-btn').nth(5);
          await nav.waitFor({ timeout: 10000 });
          await nav.click();
          await page.waitForSelector('.set-font-preview');
          const appearance = await page.evaluate(() => {
            const group = [...document.querySelectorAll('.set-seg[role="group"]')].find(g => g.querySelector('button') && /DejaVu Sans/.test(g.textContent));
            const pressed = group ? [...group.querySelectorAll('button')].map(b => `${b.textContent}:${b.getAttribute('aria-pressed')}`) : null;
            const samples = [...document.querySelectorAll('.set-font-sample-text')].map(s => ({ lang: s.getAttribute('lang'), text: s.textContent }));
            return { pressed, samples, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
          });
          row.appearance = appearance;
          const expectPressed = font === 'dejavu' ? ['false', 'true'] : ['true', 'false'];
          if (!appearance.pressed || appearance.pressed.length !== 2 || appearance.pressed.map(p => p.split(':').pop()).join() !== expectPressed.join()) fail('font control', appearance.pressed);
          if (appearance.samples.length !== 2 || appearance.samples.some(s => s.lang !== locale) || !(locale === 'uk' ? /І.*Ї.*Є.*Ґ/ : /Ё/).test(appearance.samples[0].text)) fail('font preview', appearance.samples);
          if (appearance.overflow !== 0) fail('appearance overflow', appearance.overflow);

          /* Calendar B and A at every level */
          for (const layout of ['B', 'A']) {
            await page.evaluate(() => { location.hash = '#/calendar/2026-10'; });
            await page.waitForSelector('.cal-stage[data-level="days"]');
            await page.locator('.cal-seg-btn', { hasText: layout }).first().click();
            await page.waitForTimeout(60);
            for (const h of LEVELS) {
              await page.evaluate(v => { location.hash = v; }, h);
              await page.waitForTimeout(90);
              const m = await page.evaluate(() => {
                const d = document.documentElement;
                const s = document.querySelector('.cal-stage');
                const r = s && s.getBoundingClientRect();
                const small = [...document.querySelectorAll('.cal-panel *')].filter(el => el.childElementCount === 0 && el.textContent.trim() && el.offsetParent !== null && !el.closest('.cal-sr-only'))
                  .map(el => parseFloat(getComputedStyle(el).fontSize)).filter(size => size < 12);
                return { overflow: d.scrollWidth - d.clientWidth, w: r && Math.round(r.width), h: r && Math.round(r.height), layout: s && s.dataset.layout, tiles: document.querySelectorAll('.cal-stage [data-tile]').length, small: small.length };
              });
              row.stage[`${layout} ${h}`] = m;
              if (m.overflow !== 0) fail(`overflow ${layout} ${h}`, m.overflow);
              if (m.small) fail(`text < 12px ${layout} ${h}`, m.small);
            }
          }
          const stages = Object.values(row.stage);
          const widths = [...new Set(stages.map(s => s.w))];
          const heights = [...new Set(stages.map(s => s.h))];
          if (widths.length !== 1) fail('stage width varies', widths);
          const expectH = width >= 1024 ? 620 : width >= 768 ? 560 : null;
          if (expectH && (heights.length !== 1 || heights[0] !== expectH)) fail('stage height', heights);
          if (row.stage['A #/calendar/2026-10'].tiles !== 42 || row.stage['B #/calendar/2026-08'].tiles !== 42) fail('day tiles');
          if (row.stage['B #/calendar/years'].tiles !== 12 || row.stage['B #/calendar/2026'].tiles !== 12) fail('12 tiles');
          row.stageW = widths[0];
          row.stageH = heights.length === 1 ? heights[0] : `auto(${Math.min(...heights)}–${Math.max(...heights)})`;
        } catch (error) {
          fail('exception', String(error).slice(0, 300));
        }
        if (errors.length) fail('console', errors.slice(0, 3));
        rows.push(row);
        process.stdout.write(`${tag}: ${row.fails.length ? 'FAIL ' + row.fails.join(' | ') : 'PASS'} stage=${row.stageW}x${row.stageH}\n`);
        await context.close();
      }
    }
  }
}
writeFileSync(`${SCR}/logs/combined-matrix-result.json`, JSON.stringify({ rows, logo }, null, 1));
const failed = rows.filter(r => r.fails.length);
/* the logo geometry must be identical under both fonts at every width/theme */
const logoDiff = Object.entries(logo).flatMap(([t, m]) => WIDTHS.filter(w => m[`current-${w}`] && m[`dejavu-${w}`] && m[`current-${w}`] !== m[`dejavu-${w}`]).map(w => `${t} ${w}: ${m[`current-${w}`]} vs ${m[`dejavu-${w}`]}`));
console.log(`\nCOMBINED MATRIX: ${rows.length} configurations, ${rows.length - failed.length} PASS, ${failed.length} FAIL; logo geometry differs by font: ${logoDiff.length ? logoDiff.join('; ') : 'never'}`);
console.log('logo geometry', JSON.stringify(logo));
await browser.close();
