// Text clipped inside Calendar tiles (tiles are overflow:hidden, so document
// overflow checks cannot see it): Years, Months, Days A/B, week headers, Day
// details — both fonts × RU/UK × phone and tablet widths.
import { authContext, gotoApp, launch } from './lib.mjs';

const [widthsArg = '320,340,360,390,420,768,1024,1440'] = process.argv.slice(2);
const WIDTHS = widthsArg.split(',').map(Number);
const browser = await launch();
const rows = [];
for (const width of WIDTHS) {
  for (const locale of ['ru', 'uk']) {
    for (const font of ['current', 'dejavu']) {
      const context = await authContext(browser, { width, height: 900, font, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await gotoApp(page, '#/calendar/2026', { locale });
      const clipped = {};
      for (const [level, hash, layout] of [['years', '#/calendar/years', null], ['months', '#/calendar/2026', null], ['daysB', '#/calendar/2026-08', 'B'], ['daysA', '#/calendar/2026-08', 'A'], ['day', '#/calendar/2026-10-01', null]]) {
        await page.evaluate(h => { location.hash = h; }, hash);
        await page.waitForTimeout(250);
        if (layout) {
          const pressed = await page.locator('.cal-seg-btn[aria-pressed="true"]', { hasText: layout }).count();
          if (!pressed) { await page.locator('.cal-seg-btn', { hasText: layout }).first().click(); await page.waitForTimeout(250); }
        }
        await page.evaluate(() => document.fonts.ready);
        clipped[level] = await page.evaluate(() => {
          const out = [];
          for (const box of document.querySelectorAll('.cal-stage .cal-tile, .cal-stage .cal-wrow, .cal-stage .cal-week-h')) {
            const cs = getComputedStyle(box);
            if (cs.overflow === 'visible' && cs.overflowX === 'visible') continue;
            const b = box.getBoundingClientRect();
            const right = b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) + 0.5;
            for (const el of box.querySelectorAll('*')) {
              if (el.childElementCount || !el.textContent.trim() || el.offsetParent === null) continue;
              const ecs = getComputedStyle(el);
              if (ecs.textOverflow === 'ellipsis') continue; // deliberate truncation with a visible ellipsis
              const r = el.getBoundingClientRect();
              const range = document.createRange(); range.selectNodeContents(el);
              const tr = range.getBoundingClientRect();
              const over = Math.max(r.right, tr.right) - right;
              if (over > 0.5 || el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent.trim()} (+${Math.round(over * 10) / 10}px)`);
            }
          }
          return out;
        });
      }
      rows.push({ width, locale, font, clipped });
      const bad = Object.entries(clipped).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.slice(0, 4).join(', ')}${v.length > 4 ? ` …(${v.length})` : ''}`);
      console.log(`${width} ${locale} ${font}: ${bad.length ? 'CLIPPED ' + bad.join(' | ') : 'ok'}`);
      await context.close();
    }
  }
}
await browser.close();
