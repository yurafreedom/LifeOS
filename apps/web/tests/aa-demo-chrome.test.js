import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('T-16: excludes every frozen-kit demo layout class from all product source', () => {
  const source = fileURLToPath(new URL('../src', import.meta.url));
  const banned = /aa-(?:phone|shell|rail|stage)[\w-]*/g;
  const violations = [];
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else {
        const found = readFileSync(path, 'utf8').match(banned);
        if (found) violations.push({ path, found });
      }
    }
  }
  scan(source);
  expect(violations).toEqual([]);
});
