import React from 'react';

/* global React */
/* Life OS i18n — RU primary, UA secondary.
   English slot reserved for a future iteration (LOCALES list left
   as ['ru','uk'] for now; do NOT add 'en' to it until strings exist). */

import { ru } from './locale/ru.js';
import { uk } from './locale/uk.js';
import { LIFE_LOCALES, makeT } from './locale/makeT.js';

/* The dictionaries live in ./locale/ (one file per language). This module is
   the stable public surface: every consumer keeps importing from here. */
const LIFE_STRINGS = {
  ru,
  uk,
  /* en: { ... }   ← reserved slot. Do not enable until strings exist. */
};

const LifeStrings = LIFE_STRINGS;
const LifeLocales = LIFE_LOCALES;
const LifeMakeT = (locale) => makeT(locale, LIFE_STRINGS);
const LifeLocaleContext = React.createContext({ locale: 'ru', t: LifeMakeT('ru'), setLocale: () => {} });

export { LifeStrings, LifeLocales, LifeMakeT, LifeLocaleContext };
