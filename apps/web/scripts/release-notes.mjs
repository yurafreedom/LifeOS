#!/usr/bin/env node
/* Validates the canonical release notes and writes the root CHANGELOG.md.
     npm run release-notes          → validate + regenerate CHANGELOG.md
     npm run release-notes -- --check → validate + fail if CHANGELOG.md is stale
   The source of truth is src/data/releaseNotes.json; never edit CHANGELOG.md. */

import { readFileSync, writeFileSync } from 'node:fs';

import { ru } from '../src/context/locale/ru.js';
import { uk } from '../src/context/locale/uk.js';
import { renderChangelog } from '../src/domain/releaseNotesChangelog.js';

const sourceUrl = new URL('../src/data/releaseNotes.json', import.meta.url);
const changelogUrl = new URL('../../../CHANGELOG.md', import.meta.url);

const data = JSON.parse(readFileSync(sourceUrl, 'utf8'));
let expected;
try {
  expected = renderChangelog(data, { ru, uk });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(changelogUrl, 'utf8'); } catch { /* missing → stale */ }
  if (current !== expected) {
    console.error('CHANGELOG.md is out of date. Run `npm run release-notes` in apps/web.');
    process.exit(1);
  }
  console.log('Release notes valid; CHANGELOG.md is up to date.');
} else {
  writeFileSync(changelogUrl, expected);
  console.log('Release notes valid; CHANGELOG.md written.');
}
