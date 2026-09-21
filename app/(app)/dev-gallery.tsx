import { Gallery } from '@/theme/__dev__/Gallery';

/**
 * Development-only UI kit reference. expo-router registers every file under
 * `app/`, so this route exists in production builds too — it renders nothing
 * there, and is never linked from the UI outside __DEV__.
 */
export default function DevGalleryRoute() {
  if (!__DEV__) {
    return null;
  }
  return <Gallery />;
}
