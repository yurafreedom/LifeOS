import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* The cascade is the product. styles.css only lists layers; their order is
   the original single-file order and must not change. The build-level
   guarantee (emitted CSS byte-identical) is checked when the split lands;
   this pins the order and the two trailing override layers. */
const EXPECTED = [
  'tokens', 'shell', 'panels', 'modals', 'pages-core', 'pages-life', 'home',
  'calendar-nav', 'responsive', 'theme-light', 'medications', 'finance-calendar',
  'glass', 'paradise',
];

describe('styles.css layer manifest', () => {
  const manifest = new URL('../styles.css', import.meta.url);
  const text = readFileSync(manifest, 'utf8');

  it('imports exactly the layers, in cascade order, and nothing else', () => {
    const layers = [...text.matchAll(/@import '\.\/styles\/([\w-]+)\.css';/g)].map(match => match[1]);
    expect(layers).toEqual(EXPECTED);
    const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments.replace(/@import '[^']+';/g, '').trim()).toBe('');
  });

  it('keeps glass second-to-last and paradise last', () => {
    const read = name => readFileSync(new URL(`./styles/${name}.css`, manifest), 'utf8');
    expect(read('glass')).toMatch(/glass card system/i);
    expect(read('paradise')).toMatch(/paradise/i);
    expect(read('paradise')).toContain('.money-log');
  });
});
