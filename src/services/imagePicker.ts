import * as ImagePicker from 'expo-image-picker';

import type { PickedAttachment } from '@/features/add-item/schema';

/**
 * Picking images from the photo library.
 *
 * Library only — the camera belongs with F8, which builds the scanner and owns
 * the camera permission, the preview and the OCR pass. Permission is requested
 * just-in-time, when the user taps to add a photo, as CLAUDE.md requires.
 */

export class PhotoPermissionError extends Error {
  constructor() {
    super('Photo library access was not granted.');
    this.name = 'PhotoPermissionError';
  }
}

/** Derives a usable file name when the picker does not supply one. */
function nameFor(asset: ImagePicker.ImagePickerAsset, index: number): string {
  if (asset.fileName !== null && asset.fileName !== undefined && asset.fileName !== '') {
    return asset.fileName;
  }

  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';

  return `document-${index + 1}.${extension}`;
}

export async function pickImagesFromLibrary(): Promise<PickedAttachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new PhotoPermissionError();
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: 'images',
    quality: 0.8,
    selectionLimit: 10,
  });

  if (result.canceled || result.assets === null) {
    return [];
  }

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    fileName: nameFor(asset, index),
    mimeType: asset.mimeType ?? 'image/jpeg',
    byteSize: asset.fileSize ?? 0,
  }));
}
