/* Renders the root CHANGELOG.md from the canonical release notes
   (data/releaseNotes.json). Pure: the labels come from the RU/UK UI
   dictionaries the caller passes in, so the page and the changelog share
   one wording. Driven by scripts/release-notes.mjs; release-notes.test.js
   fails when the committed CHANGELOG.md is out of date. */

import { RELEASE_LOCALES, changeGroups, validateReleaseNotes } from './releaseNotes.js';

const SOURCE_PATH = 'apps/web/src/data/releaseNotes.json';
const LOCALE_HEADINGS = { ru: 'Русский', uk: 'Українська' };

function capitalize(text) {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

function fill(template, ...args) {
  return template.replace(/\{(\d+)\}/g, (_, i) => (args[Number(i)] != null ? String(args[Number(i)]) : ''));
}

function renderEntry(entry, locale, labels) {
  const lines = [];
  const released = entry.status === 'released';
  const heading = released
    ? `${capitalize(fill(labels.upd_version, entry.version))} — ${entry.releasedOn}`
    : `${capitalize(labels.upd_status_unreleased)} — ${labels.upd_dev_build}`;
  lines.push(`### ${heading}`, '');
  if (!released) lines.push(`_${capitalize(labels.upd_no_date)}._`, '');
  lines.push(`**${entry.title[locale]}**`, '', entry.summary[locale], '');
  for (const group of changeGroups(entry)) {
    lines.push(`#### ${capitalize(labels['upd_kind_' + group.kind])}`, '');
    for (const item of group.items) lines.push(`- ${item[locale]}`);
    lines.push('');
  }
  if (entry.technical || entry.refs) {
    lines.push(`<details><summary>${capitalize(labels.upd_technical)}</summary>`, '');
    for (const item of entry.technical || []) lines.push(`- ${item[locale]}`);
    if (entry.refs) lines.push('', `${capitalize(labels.upd_refs)}: ${entry.refs.map(ref => '`' + ref.value + '`').join(', ')}`);
    lines.push('', '</details>', '');
  }
  return lines;
}

/* labelsByLocale: { ru: ruDictionary, uk: ukDictionary } */
function renderChangelog(data, labelsByLocale) {
  const result = validateReleaseNotes(data);
  if (!result.ok) throw new Error('Invalid release notes:\n' + result.errors.join('\n'));
  const lines = [
    '# JENKIN — история обновлений / історія оновлень',
    '',
    `<!-- Generated from ${SOURCE_PATH} by \`npm run release-notes\` in apps/web. Do not edit by hand. -->`,
    '',
    'Canonical source: [`' + SOURCE_PATH + '`](' + SOURCE_PATH + '). In the app: Settings → About → update history (`#/updates`).',
    '',
  ];
  for (const locale of RELEASE_LOCALES) {
    lines.push(`## ${LOCALE_HEADINGS[locale]}`, '');
    for (const entry of result.entries) lines.push(...renderEntry(entry, locale, labelsByLocale[locale]));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export { renderChangelog };
