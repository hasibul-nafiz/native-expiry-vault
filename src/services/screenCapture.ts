import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * The only file in the app that imports `expo-screen-capture`.
 *
 * On Android this sets `FLAG_SECURE`, which does two things: it blocks
 * screenshots and screen recording, and — the reason it is here — it blanks the
 * window's thumbnail in the recents switcher.
 *
 * It is deliberately not applied on iOS. `FLAG_SECURE` has no iOS equivalent,
 * and `expo-screen-capture` cannot prevent an iOS screenshot at all; calling it
 * there would imply a protection that does not exist. iOS is covered instead by
 * `PrivacyShield`, with the limitation that entails.
 *
 * It is also only applied while a PIN is enrolled. Blocking every screenshot in
 * an app the user has chosen not to lock is a cost with no matching benefit.
 */

export interface ScreenCapturePort {
  prevent(): Promise<void>;
  allow(): Promise<void>;
}

const supported = Platform.OS === 'android';

export const screenCapturePort: ScreenCapturePort = {
  async prevent() {
    if (supported) {
      await ScreenCapture.preventScreenCaptureAsync();
    }
  },

  async allow() {
    if (supported) {
      await ScreenCapture.allowScreenCaptureAsync();
    }
  },
};
