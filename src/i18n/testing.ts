import type { TFunction } from 'i18next';

import { i18n, initialiseI18n } from './index';

/**
 * A real `t` bound to a locale, for testing pure label functions.
 *
 * Deliberately the actual i18next instance rather than a stub that echoes its
 * key: a stub would let a missing key, a broken plural form or a dropped
 * interpolation pass, which is exactly what these functions exist to get right.
 */
export function testT(locale: 'en' | 'bn' = 'en'): TFunction {
  initialiseI18n(locale);

  return i18n.getFixedT(locale);
}
