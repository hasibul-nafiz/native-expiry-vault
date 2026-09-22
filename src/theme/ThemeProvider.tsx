import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from '@/settings/store';

import { darkPalette } from './tokens/palette.dark';
import { lightPalette } from './tokens/palette.light';
import { statusDark, statusLight } from './tokens/status';
import { buildBandPalette, timelineExtraDark, timelineExtraLight } from './tokens/timeline';
import { elevation, interaction, radius, spacing } from './tokens/layout';
import { typography } from './tokens/typography';
import type { ColorSchemeName, Theme } from './types';

const ThemeContext = createContext<Theme | null>(null);

function buildTheme(scheme: ColorSchemeName): Theme {
  const isDark = scheme === 'dark';
  const status = isDark ? statusDark : statusLight;

  return {
    scheme,
    colors: isDark ? darkPalette : lightPalette,
    status,
    bands: buildBandPalette(status, isDark ? timelineExtraDark : timelineExtraLight),
    typography,
    spacing,
    radius,
    elevation,
    interaction,
  };
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Forces a scheme instead of following the preference. Used by the dev gallery. */
  scheme?: ColorSchemeName;
}

export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const { theme: preference } = usePreferences();

  /**
   * An explicit prop wins, then the stored preference, then the system. The
   * preference is read from a plain file rather than the encrypted database
   * precisely so it is available here — this provider sits above the lock gate,
   * so the vault has not been opened yet.
   */
  const resolved: ColorSchemeName =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const active: ColorSchemeName = scheme ?? resolved;
  const theme = useMemo(() => buildTheme(active), [active]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }

  return theme;
}
