// Keyboard focus ring on the sidebar logo (the home button) in every theme.
import { authContext, gotoApp, launch } from './lib.mjs';

const browser = await launch();
const out = [];
for (const [theme, scene] of [['dark', null], ['light', null], ['paradise', 'day'], ['paradise', 'night']]) {
  for (const collapsed of [false, true]) {
   for (const font of ['current', 'dejavu']) {
    const context = await authContext(browser, { width: 1440, height: 900, theme, scene, font });
    const page = await context.newPage();
    await gotoApp(page, '#/tasks');
    await page.waitForSelector('.sb-logo');
    if (collapsed) {
      await page.locator('.sb-toggle').click();
      await page.reload(); // the collapsed state persists; Tab then starts from the top of the page
      await page.waitForSelector('.sb.is-collapsed .sb-logo');
    }
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    let tabs = 0;
    for (; tabs < 10; tabs++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement.matches('.sb-logo'))) break; }
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const parse = c => { const x = c && c.match(/rgba?\(([^)]+)\)/); if (!x) return null; const p = x[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
      const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
      const th = document.documentElement.dataset.theme, sc = document.documentElement.dataset.scene;
      const base = th === 'light' ? { r: 250, g: 250, b: 248, a: 1 } : th === 'paradise' ? (sc === 'day' ? { r: 120, g: 170, b: 150, a: 1 } : { r: 20, g: 40, b: 60, a: 1 }) : { r: 14, g: 17, b: 23, a: 1 };
      const logo = document.querySelector('.sb-logo');
      const chain = []; for (let n = logo.parentElement; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) chain.push(c); }
      const bd = chain.reverse().reduce((b, c) => over(c, b), base);
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
      const cs = getComputedStyle(logo);
      const ring = parse(cs.outlineColor);
      return { focused: document.activeElement.matches('.sb-logo:focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, contrast: ring ? ratio(over(ring, bd), bd) : null };
    });
    out.push({ theme: scene ? `${theme}-${scene}` : theme, collapsed, font, tabs: tabs + 1, ...m });
    await context.close();
   }
  }
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
