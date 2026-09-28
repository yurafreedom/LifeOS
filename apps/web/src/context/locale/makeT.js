/* Locale list and the t() factory. The dictionaries are passed in, so
   this module stays data-free; LocaleContext.jsx binds them. */

/* Locales the language toggle will render.
   English deliberately omitted — slot reserved in data model only. */
const LIFE_LOCALES = ['ru', 'uk'];

function makeT(locale, strings) {
  const dict = strings[locale] || strings.ru;
  const t = function(key, ...args) {
    const raw = dict[key] != null ? dict[key] : (strings.ru[key] != null ? strings.ru[key] : key);
    if (typeof raw !== 'string') return raw;
    return raw.replace(/\{(\d+)\}/g, (_, i) => args[+i] != null ? args[+i] : '');
  };
  /* Slavic 3-form plural picker.
     Usage: t.pl('pl_task', 5)  →  'задач'
     Forms are stored in the dict under pl_* keys: [one, few, many]. */
  t.pl = function(key, n) {
    const forms = (dict[key] && Array.isArray(dict[key])) ? dict[key]
                : (strings.ru[key] && Array.isArray(strings.ru[key])) ? strings.ru[key]
                : null;
    if (!forms) return '';
    const abs = Math.abs(n) | 0;
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 19) return forms[2];
    const mod10 = abs % 10;
    if (mod10 === 1)              return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
  };
  return t;
}

export { LIFE_LOCALES, makeT };
