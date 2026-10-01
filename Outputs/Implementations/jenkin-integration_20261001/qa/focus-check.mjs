// Keyboard focus on the three recorded gaps, reached with real Tab presses:
// login inputs, the TopBar search and the task-dialog title. For each: the
// indicator changes versus idle, its contrast against what is behind it, and
// no layout shift. node focus-check.mjs  (all themes × both fonts × 1440/390)
import { authContext, gotoApp, launch, ORIGIN, routeFonts } from './lib.mjs';

const THEMES = [['dark', null], ['light', null], ['paradise', 'day'], ['paradise', 'night']];
const results = [];
const browser = await launch();

/* In-page measurement helpers (installed once per page). */
const helpers = () => {
  window.__qa = {
    parse(c) { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; },
    over(t, b) { return { r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 }; },
    base() {
      const th = document.documentElement.dataset.theme, sc = document.documentElement.dataset.scene;
      return th === 'light' ? { r: 250, g: 250, b: 248, a: 1 } : th === 'paradise' ? (sc === 'day' ? { r: 120, g: 170, b: 150, a: 1 } : { r: 20, g: 40, b: 60, a: 1 }) : { r: 14, g: 17, b: 23, a: 1 };
    },
    backdrop(el) { const chain = []; for (let n = el; n; n = n.parentElement) { const c = this.parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) chain.push(c); } return chain.reverse().reduce((b, c) => this.over(c, b), this.base()); },
    lum(c) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); },
    ratio(a, b) { const [x, y] = [this.lum(a), this.lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; },
    snap(el, prop) { const cs = getComputedStyle(el); return { outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, border: cs[prop], shadow: cs.boxShadow, rect: el.getBoundingClientRect().toJSON() }; },
  };
};

async function tabTo(page, selector, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(sel => document.activeElement && document.activeElement.matches(sel), selector)) return i + 1;
  }
  return null;
}

/* Measures the indicator on `boxSel` (the element that draws it) while `focusSel`
   has focus — after transitions settle — then the idle state after blur. */
async function measure(page, focusSel, boxSel, prop) {
  await page.waitForTimeout(320);
  const focused = await page.evaluate(([f, b, p]) => {
    const q = window.__qa;
    const box = document.querySelector(b);
    const cs = getComputedStyle(box);
    const bd = q.backdrop(box.parentElement);
    const indicator = q.parse(p === 'outline' ? cs.outlineColor : cs[p]);
    return { ...q.snap(box, p), focusVisible: document.activeElement.matches(':focus-visible'), active: document.activeElement.matches(f),
      contrast: indicator ? q.ratio(q.over(indicator, bd), bd) : null, color: p === 'outline' ? cs.outlineColor : cs[p] };
  }, [focusSel, boxSel, prop]);
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(320);
  const idle = await page.evaluate(([b, p]) => window.__qa.snap(document.querySelector(b), p), [boxSel, prop]);
  await page.evaluate(f => document.querySelector(f).focus(), focusSel);
  await page.waitForTimeout(320);
  return {
    focusVisible: focused.focusVisible && focused.active, contrast: focused.contrast,
    changed: focused.outline !== idle.outline || focused.border !== idle.border || focused.shadow !== idle.shadow,
    shift: Math.round(Math.abs(focused.rect.width - idle.rect.width) + Math.abs(focused.rect.height - idle.rect.height) + Math.abs(focused.rect.x - idle.rect.x) + Math.abs(focused.rect.y - idle.rect.y)),
    focused: { outline: focused.outline, border: focused.border, shadow: focused.shadow }, idle: { outline: idle.outline, border: idle.border, shadow: idle.shadow },
  };
}

for (const width of [1440, 390]) {
  for (const [theme, scene] of THEMES) {
    for (const font of ['current', 'dejavu']) {
      const tag = `${width} ${scene ? `${theme}-${scene}` : theme} ${font}`;
      const row = { tag };
      // 1 · login (logged-out context)
      {
        const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ru-RU', timezoneId: 'Europe/Kyiv' });
        await routeFonts(context);
        await context.addInitScript(([t, s, f]) => {
          localStorage.setItem('lifeOsTheme', t);
          if (s) localStorage.setItem('lifeOsScene', s); else localStorage.removeItem('lifeOsScene');
          if (f === 'dejavu') localStorage.setItem('lifeOsFont', 'dejavu'); else localStorage.removeItem('lifeOsFont');
        }, [theme, scene, font]);
        const page = await context.newPage();
        await page.goto(`${ORIGIN}/`);
        await page.waitForSelector('.auth-form input');
        await page.evaluate(helpers);
        const presses = await tabTo(page, '.auth-form input');
        row.loginTabs = presses;
        row.login = presses ? await measure(page, '.auth-form input', '.auth-form input', 'outline') : null;
        await context.close();
      }
      // 2 · TopBar search and 3 · task dialog title (authenticated)
      {
        const context = await authContext(browser, { width, height: 900, theme, scene, font });
        const page = await context.newPage();
        await gotoApp(page, '#/tasks');
        await page.waitForSelector('.tasks-filter-select');
        await page.evaluate(helpers);
        await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
        const searchVisible = await page.locator('.tb-cmd-input').isVisible().catch(() => false);
        if (searchVisible) {
          row.searchTabs = await tabTo(page, '.tb-cmd-input', 60);
          row.search = row.searchTabs ? await measure(page, '.tb-cmd-input', '.tb-cmd', 'borderTopColor') : null;
        } else row.search = 'hidden at this width';
        // open the task dialog from a task title with the keyboard
        await page.locator('.task-title-btn').first().focus();
        await page.keyboard.press('Enter');
        await page.waitForSelector('.qa-title');
        await page.waitForTimeout(150);
        const autofocused = await page.evaluate(() => document.activeElement && document.activeElement.matches('.qa-title'));
        if (!autofocused) { await tabTo(page, '.qa-title', 20); }
        row.titleAutofocus = autofocused;
        row.title = await measure(page, '.qa-title', '.qa-title', 'borderBottomColor');
        /* leave and come back with the keyboard */
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        row.titleBack = await page.evaluate(() => document.activeElement && document.activeElement.matches('.qa-title'));
        await page.keyboard.press('Escape');
        await context.close();
      }
      const ok = v => v && typeof v === 'object' ? v.changed && v.focusVisible && v.contrast >= 3 && v.shift === 0 : v === 'hidden at this width';
      row.pass = ok(row.login) && ok(row.search) && ok(row.title) && row.titleBack;
      results.push(row);
      console.log(`${tag}: ${row.pass ? 'PASS' : 'FAIL'} login ${row.login && row.login.contrast} search ${row.search && (row.search.contrast ?? row.search)} title ${row.title && row.title.contrast}`);
    }
  }
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
