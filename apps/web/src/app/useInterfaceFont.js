import React from 'react';

const { useState } = React;

/* ── Interface font preference ─────────────────────────────
   A device-local setting like lifeOsTheme / lifeOsScene / lifeOsSidebar:
   localStorage.lifeOsFont = 'dejavu' selects DejaVu Sans; absent or any
   other value = 'current' (the existing Onest / Work Sans interface). No
   server field, snapshot field or migration. Applied as <html data-font>,
   which index.html also sets before first paint; styling is in brand.css.
   The Editorial logo is outlined SVG and never follows this setting. */
const FONT_STORAGE_KEY = 'lifeOsFont';
const INTERFACE_FONTS = ['current', 'dejavu'];

function normalizeInterfaceFont(value) {
  return value === 'dejavu' ? 'dejavu' : 'current';
}

function readInterfaceFont(storage) {
  try { return normalizeInterfaceFont(storage ? storage.getItem(FONT_STORAGE_KEY) : null); }
  catch (e) { return 'current'; }
}

function writeInterfaceFont(storage, font) {
  try {
    if (!storage) return;
    if (font === 'dejavu') storage.setItem(FONT_STORAGE_KEY, 'dejavu');
    else                   storage.removeItem(FONT_STORAGE_KEY);
  } catch (e) { /* private mode / quota: the preference simply does not persist */ }
}

function applyInterfaceFont(root, font) {
  if (!root) return;
  if (font === 'dejavu') root.setAttribute('data-font', 'dejavu');
  else                   root.removeAttribute('data-font');
}

function browserStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; }
  catch (e) { return null; }
}

function useInterfaceFont() {
  const [font, setFontRaw] = useState(() => readInterfaceFont(browserStorage()));
  function setFont(next) {
    const value = normalizeInterfaceFont(next);
    setFontRaw(value);
    writeInterfaceFont(browserStorage(), value);
    applyInterfaceFont(typeof document === 'undefined' ? null : document.documentElement, value);
  }
  return [font, setFont];
}

export {
  FONT_STORAGE_KEY, INTERFACE_FONTS,
  normalizeInterfaceFont, readInterfaceFont, writeInterfaceFont, applyInterfaceFont,
  useInterfaceFont,
};
