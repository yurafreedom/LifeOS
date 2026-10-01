import packageJson from '../../package.json';
import releaseNotesData from '../data/releaseNotes.json';
import { validateReleaseNotes } from '../domain/releaseNotes.js';

/* Build version and validated release notes, shared by the Updates page and
   Settings → About. The build version is apps/web/package.json `version`; it
   is not a release: only a 'released' entry in data/releaseNotes.json is. */
const APP_BUILD_VERSION = packageJson.version;
const RELEASE_NOTES = validateReleaseNotes(releaseNotesData);

/* Release status for Settings → About: whether unreleased changes exist, and
   the newest published release (null until one is published). */
function releaseStatus(notes = RELEASE_NOTES) {
  const entries = notes.ok ? notes.entries : [];
  return {
    hasUnreleased: entries.some(entry => entry.status === 'unreleased'),
    latestReleased: entries.find(entry => entry.status === 'released') || null,
  };
}

/* A release date is a calendar date, not an instant: format it in UTC so no
   viewer timezone can shift the day. */
function formatReleaseDate(isoDate, intlLocale) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export { APP_BUILD_VERSION, RELEASE_NOTES, formatReleaseDate, releaseStatus };
