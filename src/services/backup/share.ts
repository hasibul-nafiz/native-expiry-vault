import * as Sharing from 'expo-sharing';

import { toBackupError } from './errors';

/**
 * Handing the finished file to the user, behind a port.
 *
 * `expo-sharing` is the only way to attach a file to the system share sheet on
 * both platforms — React Native's own `Share` takes a file URL on iOS but only
 * `message` and `title` on Android. This file is its sole importer, the same
 * containment every other native library in the app has.
 *
 * Where the file goes after this is the user's decision, and it is the one
 * moment in the product where vault data leaves the device. That is exactly why
 * it is encrypted with a passphrase the app never stores: a `.evault` in a
 * cloud drive should be no more use to whoever finds it than a block of noise.
 */

/**
 * `.evault` is not a registered type, so the generic binary type is what both
 * platforms can actually act on. `public.data` is its iOS equivalent and keeps
 * AirDrop and Files as destinations rather than only text-shaped targets.
 */
const MIME_TYPE = 'application/octet-stream';
const UTI = 'public.data';

export interface SharingPort {
  isAvailable(): Promise<boolean>;
  share(fileUri: string, dialogTitle: string): Promise<void>;
}

export const sharing: SharingPort = {
  async isAvailable() {
    try {
      return await Sharing.isAvailableAsync();
    } catch {
      return false;
    }
  },

  async share(fileUri, dialogTitle) {
    try {
      await Sharing.shareAsync(fileUri, { mimeType: MIME_TYPE, UTI, dialogTitle });
    } catch (cause) {
      throw toBackupError(cause, 'io');
    }
  },
};
