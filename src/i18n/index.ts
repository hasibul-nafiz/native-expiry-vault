import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { FALLBACK_LOCALE, supportedLocales, type SupportedLocale } from '@/settings/preferences';

import bn from './locales/bn.json';
import en from './locales/en.json';

/**
 * The translation runtime.
 *
 * One flat namespace: the app is a few dozen screens, and namespaces buy
 * lazy-loading this app does not need — everything is bundled anyway because
 * there is no network to fetch from.
 *
 * Interpolation escaping is off. i18next escapes for HTML by default, which is
 * meaningless in React Native and actively wrong: it turns an apostrophe in a
 * document title into `&#39;`. React Native has no `dangerouslySetInnerHTML`
 * equivalent in the text path, so there is no injection vector to escape for.
 */

export const resources = {
  en: { translation: en },
  bn: { translation: bn },
} as const;

let initialised = false;

export function initialiseI18n(locale: SupportedLocale = FALLBACK_LOCALE): typeof i18n {
  if (initialised) {
    return i18n;
  }

  void i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: [...supportedLocales],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  initialised = true;

  return i18n;
}

/** Switches language at runtime. The store calls this when the preference changes. */
export async function setI18nLocale(locale: SupportedLocale): Promise<void> {
  initialiseI18n(locale);

  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }
}

export { i18n };
export { formatDate, formatDateLong, formatHour, formatMonthHeading, formatNumber } from './format';
