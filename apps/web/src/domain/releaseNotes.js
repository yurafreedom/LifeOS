/* JENKIN release notes — schema and validation (pure, no imports).

   The canonical, repository-backed source is ../data/releaseNotes.json. The
   Updates page (#/updates) renders it, and scripts/release-notes.mjs
   generates the root CHANGELOG.md from it; nothing else holds release
   content. The page, the generator and the tests all go through
   validateReleaseNotes, so a malformed entry fails `npm test` before it can
   reach a build.

   Version policy (docs/product/JENKIN_PRODUCT_OVERVIEW.md, «Версии»):
   - the application/build version is apps/web/package.json `version`;
   - a published release is an entry with status 'released', a semver
     version and the real release date;
   - at most one 'unreleased' entry collects user-facing changes during
     development: it has no version and no date (a commit date is not a
     release date) and always sits first. */

const RELEASE_NOTES_SCHEMA_VERSION = 1;
const RELEASE_STATUSES = ['unreleased', 'released'];
/* Order of the change groups on the page and in CHANGELOG.md. */
const RELEASE_CHANGE_KINDS = ['features', 'improvements', 'fixes', 'security', 'limitations'];
const RELEASE_LOCALES = ['ru', 'uk'];

const ENTRY_KEYS = ['id', 'status', 'version', 'releasedOn', 'title', 'summary', 'changes', 'technical', 'refs'];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;

/* User-facing notes must not carry private or environment-specific details. */
const FORBIDDEN_TEXT = [
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/, why: 'an email address' },
  { re: /(^|[\s("'«])(\/Users\/|\/home\/|\/private\/|~\/|[A-Za-z]:\\)/, why: 'a local filesystem path' },
  { re: /\b(localhost|127\.0\.0\.1)\b/, why: 'a local address' },
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRealDate(value) {
  const match = typeof value === 'string' ? DATE_RE.exec(value) : null;
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/* -1 / 0 / 1 for two valid semver strings. */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function checkText(value, where, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${where}: expected { ru, uk }`);
    return;
  }
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!RELEASE_LOCALES.includes(key)) errors.push(`${where}: unknown locale "${key}"`);
  }
  for (const locale of RELEASE_LOCALES) {
    const text = value[locale];
    if (typeof text !== 'string' || !text.trim()) {
      errors.push(`${where}.${locale}: missing text`);
      continue;
    }
    if (text !== text.trim()) errors.push(`${where}.${locale}: leading or trailing whitespace`);
    for (const rule of FORBIDDEN_TEXT) {
      if (rule.re.test(text)) errors.push(`${where}.${locale}: contains ${rule.why}`);
    }
  }
}

function checkTextList(value, where, errors, { required }) {
  if (value === undefined && !required) return;
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${where}: expected a non-empty list`);
    return;
  }
  value.forEach((item, i) => checkText(item, `${where}[${i}]`, errors));
}

function checkEntry(entry, where, errors) {
  if (!isPlainObject(entry)) {
    errors.push(`${where}: expected an object`);
    return;
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(key)) errors.push(`${where}: unknown field "${key}"`);
  }
  if (typeof entry.id !== 'string' || !ID_RE.test(entry.id)) errors.push(`${where}.id: expected a kebab-case id`);
  if (!RELEASE_STATUSES.includes(entry.status)) errors.push(`${where}.status: expected one of ${RELEASE_STATUSES.join(', ')}`);

  if (entry.status === 'released') {
    if (typeof entry.version !== 'string' || !SEMVER_RE.test(entry.version)) errors.push(`${where}.version: a released entry needs a MAJOR.MINOR.PATCH version`);
    if (!isRealDate(entry.releasedOn)) errors.push(`${where}.releasedOn: a released entry needs its real release date (YYYY-MM-DD)`);
  } else if (entry.status === 'unreleased') {
    if (entry.version !== null) errors.push(`${where}.version: an unreleased entry has no version (null)`);
    if (entry.releasedOn !== null) errors.push(`${where}.releasedOn: an unreleased entry has no release date (null)`);
  }

  checkText(entry.title, `${where}.title`, errors);
  checkText(entry.summary, `${where}.summary`, errors);

  if (!isPlainObject(entry.changes)) {
    errors.push(`${where}.changes: expected an object of change groups`);
  } else {
    const kinds = Object.keys(entry.changes);
    if (kinds.length === 0) errors.push(`${where}.changes: at least one change group`);
    for (const kind of kinds) {
      if (!RELEASE_CHANGE_KINDS.includes(kind)) errors.push(`${where}.changes: unknown group "${kind}"`);
      else checkTextList(entry.changes[kind], `${where}.changes.${kind}`, errors, { required: true });
    }
  }

  checkTextList(entry.technical, `${where}.technical`, errors, { required: false });

  if (entry.refs !== undefined) {
    if (!Array.isArray(entry.refs) || entry.refs.length === 0) {
      errors.push(`${where}.refs: expected a non-empty list`);
    } else {
      entry.refs.forEach((ref, i) => {
        if (!isPlainObject(ref) || ref.kind !== 'commit' || typeof ref.value !== 'string' || !COMMIT_RE.test(ref.value) || Object.keys(ref).length !== 2) {
          errors.push(`${where}.refs[${i}]: expected { kind: "commit", value: <hex sha> }`);
        }
      });
    }
  }
}

/* Newest first: the one unreleased entry (if any) on top, then released
   entries by strictly descending date and version. */
function checkOrder(entries, errors) {
  const ids = new Set();
  entries.forEach((entry, i) => {
    if (ids.has(entry.id)) errors.push(`entries[${i}].id: duplicate "${entry.id}"`);
    ids.add(entry.id);
  });
  const unreleased = entries.filter(entry => entry.status === 'unreleased');
  if (unreleased.length > 1) errors.push('entries: at most one unreleased entry');
  if (unreleased.length === 1 && entries[0].status !== 'unreleased') errors.push('entries: the unreleased entry must be first');

  const released = entries.filter(entry => entry.status === 'released');
  for (let i = 1; i < released.length; i += 1) {
    const newer = released[i - 1];
    const older = released[i];
    if (!(newer.releasedOn >= older.releasedOn)) errors.push(`entries: "${newer.id}" must not be older than "${older.id}" (newest first)`);
    if (compareVersions(newer.version, older.version) <= 0) errors.push(`entries: version ${newer.version} must be greater than ${older.version} (newest first)`);
  }
}

/* → { ok: true, entries } | { ok: false, errors: string[] } */
function validateReleaseNotes(data) {
  const errors = [];
  if (!isPlainObject(data)) return { ok: false, errors: ['root: expected an object'] };
  for (const key of Object.keys(data)) {
    if (key !== 'schemaVersion' && key !== 'entries') errors.push(`root: unknown field "${key}"`);
  }
  if (data.schemaVersion !== RELEASE_NOTES_SCHEMA_VERSION) errors.push(`schemaVersion: expected ${RELEASE_NOTES_SCHEMA_VERSION}`);
  if (!Array.isArray(data.entries)) {
    errors.push('entries: expected a list');
    return { ok: false, errors };
  }
  data.entries.forEach((entry, i) => checkEntry(entry, `entries[${i}]`, errors));
  if (errors.length === 0) checkOrder(data.entries, errors);
  return errors.length ? { ok: false, errors } : { ok: true, entries: data.entries };
}

/* Change groups of one entry in display order, empty groups skipped. */
function changeGroups(entry) {
  return RELEASE_CHANGE_KINDS
    .filter(kind => Array.isArray(entry.changes[kind]) && entry.changes[kind].length > 0)
    .map(kind => ({ kind, items: entry.changes[kind] }));
}

export {
  RELEASE_CHANGE_KINDS,
  RELEASE_LOCALES,
  RELEASE_NOTES_SCHEMA_VERSION,
  RELEASE_STATUSES,
  changeGroups,
  compareVersions,
  validateReleaseNotes,
};
