import React from 'react';
import { LIFE_LOCALES } from '../context/locale/makeT.js';

const { useEffect, useState } = React;

/* ── Interface language preference ─────────────────────────
   A device-local setting like lifeOsTheme / lifeOsFont:
   localStorage.lifeOsLocale = 'ru' | 'uk'. Absent, unreadable or any other
   value = 'ru' (the primary locale); an invalid stored value is ignored, never
   trusted. Not per account and not in the server snapshot, so the login and
   setup pages (rendered before any account exists) follow it too.

   Read once when a tab starts; there is deliberately no `storage` listener,
   matching theme and font: switching the language in one tab never flips the
   text of another open tab mid-use — that tab picks the choice up on its next
   load. Applied as <html lang>, which index.html also sets before first paint. */
const LOCALE_STORAGE_KEY = 'lifeOsLocale';
const DEFAULT_LOCALE = 'ru';

function normalizeLocale(value) {
  return LIFE_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

function readLocale(storage) {
  try { return normalizeLocale(storage ? storage.getItem(LOCALE_STORAGE_KEY) : null); }
  catch (e) { return DEFAULT_LOCALE; }
}

function writeLocale(storage, locale) {
  try {
    if (storage) storage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch (e) { /* private mode / quota: the preference simply does not persist */ }
}

function applyLocale(root, locale) {
  if (root) root.setAttribute('lang', normalizeLocale(locale));
}

function browserStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch (e) { return null; }
}

function useLocalePreference() {
  const [locale, setLocaleRaw] = useState(() => readLocale(browserStorage()));
  useEffect(() => {
    applyLocale(typeof document === 'undefined' ? null : document.documentElement, locale);
  }, [locale]);
  function setLocale(next) {
    if (!LIFE_LOCALES.includes(next)) return;
    setLocaleRaw(next);
    writeLocale(browserStorage(), next);
  }
  return [locale, setLocale];
}

export {
  LOCALE_STORAGE_KEY, DEFAULT_LOCALE,
  normalizeLocale, readLocale, writeLocale, applyLocale,
  useLocalePreference,
};
