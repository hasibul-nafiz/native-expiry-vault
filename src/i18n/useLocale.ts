import { getLocales } from 'expo-localization';
import { useEffect, useMemo } from 'react';

import { resolveLocale, type SupportedLocale } from '@/settings/preferences';
import { usePreferences } from '@/settings/store';

import { setI18nLocale } from './index';

/**
 * Resolves the active locale from the language preference and the device, and
 * keeps i18next in step with it.
 *
 * Device locales are read through `getLocales()` on every render rather than
 * captured once: the OS list can change while the app is backgrounded, and the
 * call is a cheap synchronous read of an already-loaded constant.
 */
export function useLocale(): SupportedLocale {
  const { language } = usePreferences();

  const locale = useMemo(
    () =>
      resolveLocale(
        language,
        getLocales().map((entry) => entry.languageTag),
      ),
    [language],
  );

  useEffect(() => {
    void setI18nLocale(locale);
  }, [locale]);

  return locale;
}
