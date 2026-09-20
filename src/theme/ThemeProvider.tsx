import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkPalette } from './tokens/palette.dark';
import { lightPalette } from './tokens/palette.light';
import { statusDark, statusLight } from './tokens/status';
import { elevation, interaction, radius, spacing } from './tokens/layout';
import { typography } from './tokens/typography';
import type { ColorSchemeName, Theme } from './types';

const ThemeContext = createContext<Theme | null>(null);

function buildTheme(scheme: ColorSchemeName): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkPalette : lightPalette,
    status: scheme === 'dark' ? statusDark : statusLight,
    typography,
    spacing,
    radius,
    elevation,
    interaction,
  };
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Forces a scheme instead of following the system. Used by the dev gallery. */
  scheme?: ColorSchemeName;
}

export function ThemeProvider({ children, scheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const active: ColorSchemeName = scheme ?? (systemScheme === 'dark' ? 'dark' : 'light');
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
