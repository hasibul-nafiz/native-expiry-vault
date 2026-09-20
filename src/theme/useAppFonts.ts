import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/**
 * Loads the four Inter weights the type scale uses. Runtime loading rather than
 * the expo-font config plugin so the app runs without a native rebuild; the
 * weights are baked into family names, so both platforms resolve them the same way.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return loaded;
}
