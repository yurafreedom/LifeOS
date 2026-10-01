// Which font actually drew the glyphs (Chromium CDP CSS.getPlatformFontsForNode):
// "[web]" = a downloaded webfont, "[system]" = an OS font. DejaVu Sans is also
// installed as an OS font here, so only "[web]" proves the app's DejaVu webfont.
// Covers the shell, Tasks, every Calendar level, Day details, the editor,
// History, Settings → Appearance and the login card, in RU and UK, both fonts,
// all four themes at 1440 px; plus which WOFF files were requested.
import { writeFileSync } from 'node:fs';
import { authContext, gotoApp, launch, ORIGIN, routeFonts, SCR } from './lib.mjs';
import { LONG_TITLE, seed } from './seed.mjs';

const THEMES = [['dark', null], ['light', null], ['paradise', 'day'], ['paradise', 'night']];
const seeded = await seed();
const today = seeded.today;
const browser = await launch();
const out = [];

/* .mono role (class mono): keeps --font-mono (Work Sans + the OS Cyrillic fallback) in both fonts */
const MONO = new Set(['tasks.due', 'tasks.filterLabel', 'cal.weekRange', 'cal.todayBtn', 'history.date', 'day.meta', 'settings.previewLabel', 'sidebar.sync', 'editor.label']);
/* --font-display (Onest under Current); the login heading is body text (Work Sans) */
const DISPLAY = new Set(['topbar.greeting', 'cal.crumbCurrent', 'cal.yearNum', 'cal.monthNum', 'cal.dayNum', 'day.month', 'day.bigNum', 'editor.heading', 'tasksDetail.title']);

async function glyphs(page, marks) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(m => {
    for (const [name, selector, textStarts] of m) {
      const el = [...document.querySelectorAll(selector)].find(e => e.offsetParent !== null && (!textStarts || textStarts.split('|').some(p => (e.value || e.textContent).trim().startsWith(p))));
      if (el) el.setAttribute('data-qa-glyph', name);
    }
  }, marks);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const res = {};
  for (const [name] of marks) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-qa-glyph="${name}"]` });
    if (!nodeId) { res[name] = 'absent'; continue; }
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const text = await page.$eval(`[data-qa-glyph="${name}"]`, el => (el.value || el.textContent).trim().slice(0, 48));
    res[name] = { text, fonts: fonts.map(f => `${f.familyName} ${f.isCustomFont ? '[web]' : '[system]'} ×${f.glyphCount}`) };
  }
  await cdp.detach();
  return res;
}

for (const font of ['current', 'dejavu']) {
  for (const locale of ['ru', 'uk']) {
    for (const [theme, scene] of THEMES) {
      const themeName = scene ? `${theme}-${scene}` : theme;
      const context = await authContext(browser, { width: 1440, height: 900, theme, scene, font });
      const woff = [];
      context.on('request', r => { if (/DejaVuSans[\w-]*\.woff/.test(r.url())) woff.push(`${r.url().split('/').pop().replace(/-[\w]{8}\.woff$/, '.woff')}`); });
      const page = await context.newPage();
      const row = { font, locale, theme: themeName, nodes: {} };
      await gotoApp(page, '#/tasks', { locale });
      await page.waitForSelector('.tasks-filter-select');
      const woffBeforeSettings = new Set(woff);
      Object.assign(row.nodes, await glyphs(page, [
        ['tasks.longTitle', '.tasks-page .task-title-btn', 'Ёлка'], ['tasks.due', '.tasks-page .task-due'],
        ['tasks.filterLabel', '.tasks-filter-label'], ['sidebar.navLabel', '.sb-item .sb-label'],
        ['sidebar.email', '.sb-foot-name'], ['sidebar.sync', '.sb-sync-text'], ['topbar.greeting', '.tb-title'],
      ]));
      /* Tasks detail dialog on the long title */
      await page.locator('.tasks-page .task-title-btn', { hasText: 'Ёлка' }).click();
      await page.waitForSelector('.qa-title');
      Object.assign(row.nodes, await glyphs(page, [['tasksDetail.title', '.qa-title']]));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      /* Calendar levels */
      await page.evaluate(() => { location.hash = '#/calendar/years'; });
      await page.waitForSelector('.cal-grid-years');
      await page.waitForTimeout(650);
      Object.assign(row.nodes, await glyphs(page, [['cal.yearNum', '.cal-num-year'], ['cal.crumbCurrent', '.cal-crumb[aria-current="page"]']]));
      await page.evaluate(() => { location.hash = '#/calendar/2026'; });
      await page.waitForSelector('.cal-grid-months');
      await page.waitForTimeout(650);
      Object.assign(row.nodes, await glyphs(page, [['cal.monthNum', '.cal-num-month'], ['cal.monthName', '.cal-tile-month .cal-eyebrow']]));
      await page.evaluate(m => { location.hash = `#/calendar/${m}`; }, today.slice(0, 7));
      await page.waitForSelector('.cal-grid-b');
      await page.waitForTimeout(650);
      Object.assign(row.nodes, await glyphs(page, [
        ['cal.weekLabel', '.cal-week-h span'], ['cal.weekRange', '.cal-week-h .mono'], ['cal.weekday', '.cal-wd'],
        ['cal.dayNum', '.cal-num-row'], ['cal.count', '.cal-line'], ['cal.todayBtn', '.cal-seg-btn.mono'],
        ['cal.layoutLabel', '.cal-seg-long'], ['cal.historyBtn', '.cal-history-btn'],
      ]));
      await page.evaluate(d => { location.hash = `#/calendar/${d}`; }, today);
      await page.waitForSelector('.cal-task');
      await page.waitForTimeout(650);
      Object.assign(row.nodes, await glyphs(page, [
        ['day.month', '.cal-day-month'], ['day.bigNum', '.cal-day-summary .cal-num'], ['day.eyebrow', '.cal-day-summary .cal-eyebrow'],
        ['day.longTitle', '.cal-task-title', 'Ёлка'], ['day.meta', '.cal-task-meta'], ['day.act', '.cal-act', 'изм|змі'], ['day.add', '.cal-add'],
      ]));
      await page.locator('.cal-task', { hasText: 'Ёлка' }).locator('.cal-act').filter({ hasText: /изменить|змінити/ }).click();
      await page.waitForSelector('.cal-editor');
      Object.assign(row.nodes, await glyphs(page, [['editor.heading', '.cal-dialog-h'], ['editor.titleInput', '.cal-editor input.cal-input'], ['editor.label', '.cal-editor .cal-field-lab']]));
      await page.keyboard.press('Escape');
      await page.evaluate(() => { location.hash = '#/calendar/history'; });
      await page.waitForSelector('.cal-history');
      await page.waitForTimeout(650);
      Object.assign(row.nodes, await glyphs(page, [['history.title', '.cal-history-title'], ['history.state', '.cal-state'], ['history.date', '.cal-history-num']]));
      /* Settings → Appearance */
      await page.evaluate(() => { location.hash = '#/settings'; });
      await page.locator('.set-nav-btn').nth(5).click();
      await page.waitForSelector('.set-font-preview');
      Object.assign(row.nodes, await glyphs(page, [
        ['settings.previewDejavu', '.set-font-sample.is-dejavu .set-font-sample-text'], ['settings.previewCurrent', '.set-font-sample.is-current .set-font-sample-text'],
        ['settings.previewLabel', '.set-font-sample-label'], ['settings.segBtn', '.set-seg-btn'],
      ]));
      row.woffOnTasksCalendar = [...woffBeforeSettings];
      row.woffTotal = [...new Set(woff)];
      out.push(row);
      await context.close();
      process.stdout.write(`${font} ${locale} ${themeName}: nodes ${Object.keys(row.nodes).length} woff ${row.woffTotal.join(',') || '-'}\n`);
    }
  }
}
/* login card (logged out), RU default + UK via the in-app locale then logout */
for (const font of ['current', 'dejavu']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Europe/Kyiv' });
  await routeFonts(context);
  await context.addInitScript(f => { if (f === 'dejavu') localStorage.setItem('lifeOsFont', 'dejavu'); else localStorage.removeItem('lifeOsFont'); }, font);
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('.auth-card h1');
  out.push({ font, locale: 'ru', theme: 'login', nodes: await glyphs(page, [['login.heading', '.auth-card h1'], ['login.label', '.auth-form label'], ['login.submit', '.auth-submit']]) });
  await context.close();
}

/* verdicts */
const verdicts = [];
for (const row of out) {
  for (const [name, v] of Object.entries(row.nodes)) {
    if (v === 'absent') { verdicts.push(`${row.font} ${row.locale} ${row.theme} ${name}: ABSENT`); continue; }
    const web = v.fonts.filter(f => f.includes('[web]'));
    const sys = v.fonts.filter(f => f.includes('[system]'));
    let ok = true;
    if (name === 'settings.previewDejavu') ok = v.fonts.length === 1 && /^DejaVu Sans \[web\]/.test(v.fonts[0]);
    else if (name === 'settings.previewCurrent' || MONO.has(name)) ok = !v.fonts.some(f => /^DejaVu Sans \[web\]/.test(f)); // the Current / mono face is kept
    else if (row.font === 'dejavu') ok = v.fonts.length === 1 && /^DejaVu Sans \[web\]/.test(v.fonts[0]);
    else ok = !v.fonts.some(f => /^DejaVu Sans \[web\]/.test(f)) && (DISPLAY.has(name) ? web.some(f => f.startsWith('Onest')) : true);
    if (!ok) verdicts.push(`${row.font} ${row.locale} ${row.theme} ${name}: UNEXPECTED ${v.fonts.join(' + ')} :: ${v.text}`);
    void sys;
  }
}
writeFileSync(`${SCR}/logs/glyph-check-result.json`, JSON.stringify({ today, out, verdicts }, null, 1));
console.log(`\nGLYPHS: ${out.reduce((n, r) => n + Object.keys(r.nodes).length, 0)} nodes, ${verdicts.length} unexpected`);
for (const v of verdicts.slice(0, 40)) console.log(v);
await browser.close();
