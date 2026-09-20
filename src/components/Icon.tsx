import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useTheme } from '@/theme';
import type { PaletteColor } from '@/theme';

/**
 * The app's only icon source.
 *
 * `@expo/vector-icons` is imported here and nowhere else, so swapping the icon
 * set later is a single-file change. Callers name icons semantically rather than
 * by glyph, which also keeps the Stitch export's Material Symbol names from
 * leaking into feature code.
 *
 * MaterialIcons is the match for that export: it carries the same glyphs under
 * kebab-cased versions of the same names.
 */

const glyphs = {
  add: 'add',
  alertActive: 'notifications-active',
  bell: 'notifications',
  category: 'badge',
  chevronRight: 'chevron-right',
  clear: 'close',
  document: 'description',
  empty: 'inbox',
  error: 'error-outline',
  expired: 'warning',
  health: 'health-and-safety',
  identity: 'contact-mail',
  licence: 'directions-car',
  nextUp: 'hourglass-top',
  passport: 'public',
  reminder: 'event',
  safe: 'check-circle',
  search: 'search',
  soon: 'schedule',
  vault: 'shield',
  visa: 'flight-takeoff',
  warranty: 'inventory-2',
} as const;

export type IconName = keyof typeof glyphs;

export interface IconProps {
  name: IconName;
  /** A palette token. Use `tone` or `color`, not both. */
  color?: PaletteColor;
  /** An explicit colour, for the status tokens that sit outside the palette. */
  tone?: string;
  size?: number;
  testID?: string;
}

/** Sized to the export, which uses 16/20/22/28px glyphs. */
const DEFAULT_SIZE = 20;

export function Icon({ name, color = 'onSurface', tone, size = DEFAULT_SIZE, testID }: IconProps) {
  const theme = useTheme();

  return (
    <MaterialIcons
      // Decorative by default: the label belongs on the control that wraps it,
      // which is why IconButton requires an accessibilityLabel.
      accessibilityElementsHidden
      color={tone ?? theme.colors[color]}
      importantForAccessibility="no-hide-descendants"
      name={glyphs[name]}
      size={size}
      testID={testID}
    />
  );
}

/** Maps a document category to its glyph, following the export's row icons. */
export function iconForCategory(category: string): IconName {
  switch (category) {
    case 'passport':
      return 'passport';
    case 'visa':
      return 'visa';
    case 'health':
      return 'health';
    case 'license':
      return 'licence';
    case 'warranty':
      return 'warranty';
    case 'contract':
      return 'identity';
    default:
      return 'document';
  }
}
