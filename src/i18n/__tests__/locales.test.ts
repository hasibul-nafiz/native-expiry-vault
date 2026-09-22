import { supportedLocales, type SupportedLocale } from '@/settings/preferences';

import { resources } from '../index';

/**
 * The missing-key check.
 *
 * Reads `supportedLocales` rather than a hardcoded list, so adding a locale to
 * that array fails here until its file is complete — which is what stops a new
 * language shipping half-translated.
 */

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;

    if (typeof value === 'string') {
      flat.set(path, value);
    } else {
      for (const [nested, nestedValue] of flatten(value, path)) {
        flat.set(nested, nestedValue);
      }
    }
  }

  return flat;
}

function keysFor(locale: SupportedLocale): Map<string, string> {
  return flatten(resources[locale].translation as Tree);
}

const reference = keysFor('en');

/** `{{name}}` placeholders, which must survive translation or interpolation breaks. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

describe('every supported locale has a translation file', () => {
  it.each(supportedLocales)('%s is registered in resources', (locale) => {
    expect(resources[locale]?.translation).toBeDefined();
  });
});

describe('English is the reference catalogue', () => {
  it('has keys', () => {
    expect(reference.size).toBeGreaterThan(0);
  });

  it('has no empty values', () => {
    const empty = [...reference].filter(([, value]) => value.trim() === '').map(([key]) => key);

    expect(empty).toEqual([]);
  });
});

describe.each(supportedLocales.filter((locale) => locale !== 'en'))(
  '%s matches the English catalogue',
  (locale) => {
    const translation = keysFor(locale);

    it('is missing no key', () => {
      const missing = [...reference.keys()].filter((key) => !translation.has(key));

      expect(missing).toEqual([]);
    });

    it('has no key English does not have', () => {
      const extra = [...translation.keys()].filter((key) => !reference.has(key));

      expect(extra).toEqual([]);
    });

    it('has no empty values', () => {
      const empty = [...translation].filter(([, value]) => value.trim() === '').map(([key]) => key);

      expect(empty).toEqual([]);
    });

    /**
     * A dropped or renamed placeholder is the failure that survives review:
     * the string reads fine and renders a literal `{{count}}` at runtime.
     */
    it('keeps every interpolation placeholder', () => {
      const broken: string[] = [];

      for (const [key, english] of reference) {
        const translated = translation.get(key);

        if (translated === undefined) {
          continue;
        }

        if (placeholders(english).join(',') !== placeholders(translated).join(',')) {
          broken.push(key);
        }
      }

      expect(broken).toEqual([]);
    });

    /**
     * i18next resolves plurals by suffix. A locale that provides `_one` without
     * `_other` silently falls back to the key itself at runtime.
     */
    it('provides both plural forms wherever English does', () => {
      const incomplete = [...reference.keys()]
        .filter((key) => key.endsWith('_one'))
        .map((key) => key.replace(/_one$/, '_other'))
        .filter((other) => !translation.has(other));

      expect(incomplete).toEqual([]);
    });
  },
);
