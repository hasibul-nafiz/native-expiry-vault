import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * On-device text recognition.
 *
 * The only file that imports `@react-native-ml-kit/text-recognition`, the same
 * containment `notifications.ts` gives `expo-notifications` and `Icon.tsx`
 * gives the icon library. It is what lets the parsers and the scan pipeline be
 * tested without a native module in the path.
 *
 * **Nothing leaves the device.** ML Kit's text recognition runs entirely
 * in-process against a local file: the model ships in the binary, there is no
 * API key, and no request is made. This app has no network client at all.
 *
 * The port is deliberately narrowed to plain text. ML Kit also returns blocks,
 * lines, words, bounding boxes and corner points, and F8 uses none of them — a
 * wider port would only be a wider thing to fake in tests.
 *
 * It is a bare native module with no config plugin, so recognition requires a
 * development build. Expo Go already cannot run this app, which needs SQLCipher.
 */

export class OcrUnavailableError extends Error {
  constructor(readonly cause: unknown) {
    super('Text recognition is not available on this build.');
    this.name = 'OcrUnavailableError';
  }
}

export interface OcrPort {
  /** Recognised text for a local image, or an empty string if there is none. */
  recognize(imageUri: string): Promise<string>;
}

export const ocrPort: OcrPort = {
  async recognize(imageUri) {
    try {
      const result = await TextRecognition.recognize(imageUri);

      return result.text;
    } catch (error) {
      // The library throws a linking error when the native module is missing,
      // which is a build problem, not a bad photo. Distinguished so the
      // scanner can say so instead of blaming the image.
      throw new OcrUnavailableError(error);
    }
  },
};
