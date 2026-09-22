import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansBengali_400Regular,
  NotoSansBengali_500Medium,
  NotoSansBengali_600SemiBold,
  NotoSansBengali_700Bold,
} from '@expo-google-fonts/noto-sans-bengali';
import { useFonts } from 'expo-font';

/**
 * Loads the four Inter weights the type scale uses, plus their Bengali
 * counterparts.
 *
 * Inter has no Bengali coverage at all — with Inter alone, every Bengali string
 * renders as tofu or silently falls back to a system face that does not match
 * the type scale. Noto Sans Bengali is the matching design, so the two switch
 * cleanly at the same weights.
 *
 * Runtime loading rather than the expo-font config plugin so the app runs
 * without a native rebuild; the weights are baked into family names, so both
 * platforms resolve them the same way.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansBengali_400Regular,
    NotoSansBengali_500Medium,
    NotoSansBengali_600SemiBold,
    NotoSansBengali_700Bold,
  });

  return loaded;
}
