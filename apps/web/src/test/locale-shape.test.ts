import { describe, expect, it } from 'vitest';

import { LifeLocales, LifeMakeT, LifeStrings as Strings } from '../context/LocaleContext.jsx';

type Dictionary = Record<string, unknown>;
const LifeStrings = Strings as unknown as Record<string, Dictionary> & { ru: Dictionary; uk: Dictionary };
const pl = (dict: Dictionary, key: string) => dict[key] as string[];

/* Characterization of the whole locale dictionary and of makeT, so the
   dictionaries can be moved between files without a copy or lookup change. */

describe('locale dictionary shape', () => {
  it('ships exactly the ru and uk dictionaries', () => {
    expect(Object.keys(LifeStrings)).toEqual(['ru', 'uk']);
    expect(LifeLocales).toEqual(['ru', 'uk']);
    expect(LifeStrings.en).toBeUndefined();
  });

  it('keeps uk a subset of ru, with the one known ru-only flag', () => {
    const ru = Object.keys(LifeStrings.ru);
    const uk = Object.keys(LifeStrings.uk);
    expect(ru).toHaveLength(1822);
    expect(uk).toHaveLength(1821);
    expect(uk.filter((key) => !(key in LifeStrings.ru))).toEqual([]);
    expect(ru.filter((key) => !(key in LifeStrings.uk))).toEqual(['today_date_uppercase']);
    expect(LifeStrings.ru.today_date_uppercase).toBe(true);
  });

  it('holds only strings, 3-form plural arrays and the one boolean flag', () => {
    for (const dict of [LifeStrings.ru, LifeStrings.uk]) {
      for (const [key, value] of Object.entries(dict)) {
        if (Array.isArray(value)) {
          expect(key.startsWith('pl_')).toBe(true);
          expect(value).toHaveLength(3);
        } else if (key === 'today_date_uppercase') {
          expect(typeof value).toBe('boolean');
        } else {
          expect(typeof value).toBe('string');
        }
      }
    }
    expect(LifeStrings.ru._intl_locale).toBe('ru-RU');
    expect(LifeStrings.uk._intl_locale).toBe('uk-UA');
  });
});

describe('makeT', () => {
  it('falls back to ru for a key uk does not define, then to the key itself', () => {
    const t = LifeMakeT('uk');
    expect(t('today_date_uppercase')).toBe(true);
    expect(t('no_such_key_anywhere')).toBe('no_such_key_anywhere');
  });

  it('falls back to the ru dictionary for an unknown locale', () => {
    expect(LifeMakeT('en')('_intl_locale')).toBe('ru-RU');
  });

  it('substitutes positional arguments', () => {
    const key = Object.keys(LifeStrings.ru).find(
      (k) => typeof LifeStrings.ru[k] === 'string' && (LifeStrings.ru[k] as string).includes('{0}'),
    );
    expect(key).toBeDefined();
    const out = LifeMakeT('ru')(key as string, 'XYZ');
    expect(out).toContain('XYZ');
    expect(out).not.toContain('{0}');
  });

  it('picks the Slavic one/few/many plural form', () => {
    const forms = pl(LifeStrings.ru, 'pl_task');
    const t = LifeMakeT('ru');
    expect(t.pl('pl_task', 1)).toBe(forms[0]);
    expect(t.pl('pl_task', 3)).toBe(forms[1]);
    expect(t.pl('pl_task', 5)).toBe(forms[2]);
    expect(t.pl('pl_task', 11)).toBe(forms[2]);
    expect(t.pl('pl_task', 21)).toBe(forms[0]);
    expect(t.pl('pl_task', 22)).toBe(forms[1]);
    expect(t.pl('pl_task', 111)).toBe(forms[2]);
    expect(t.pl('no_such_plural', 2)).toBe('');
  });

  it('uses uk plural forms for uk', () => {
    expect(LifeMakeT('uk').pl('pl_goal', 2)).toBe(pl(LifeStrings.uk, 'pl_goal')[1]);
  });
});
