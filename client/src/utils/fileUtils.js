import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Checks whether an error represents an intentional user cancellation.
 */
export const isUserCancellation = (error) => {
  if (!error) return false;
  const msg = (typeof error === 'string' ? error : error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    msg.includes('cancel') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    code === 'DOCUMENT_PICKER_CANCELED' ||
    code === 'E_PICKER_CANCELLED'
  );
};

/**
 * Resolves appropriate MIME type from file metadata or filename extension.
 */
export const getMimeType = (file) => {
  if (file?.mimeType) return file.mimeType;

  const fileName = (file?.name || file?.uri || '').toLowerCase();
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.gif')) return 'image/gif';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  if (fileName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (fileName.endsWith('.doc')) return 'application/msword';
  return 'image/jpeg';
};

/**
 * Robustly reads an asset file into base64 format.
 * Works seamlessly with:
 * - Android content:// URIs (safely copies to cache first if needed)
 * - Android SAF / provider URIs
 * - iOS file:// URIs
 * - React Native FileReader / Blob fallback
 */
export const readAssetAsBase64 = async (file) => {
  if (!file || !file.uri) {
    throw new Error('Invalid file reference: URI is missing.');
  }

  const mimeType = getMimeType(file);
  let base64 = '';
  let tempCachedUri = null;

  try {
    let sourceUri = file.uri;

    // On Android, content:// URIs from media providers or downloads can fail
    // legacy FileSystem reads directly. Copying to the app's cache directory first resolves this cleanly.
    if (sourceUri.startsWith('content://')) {
      try {
        const extension = mimeType.split('/')[1] || 'jpg';
        tempCachedUri = `${FileSystem.cacheDirectory}temp_photo_${Date.now()}.${extension}`;
        await FileSystem.copyAsync({
          from: sourceUri,
          to: tempCachedUri,
        });
        sourceUri = tempCachedUri;
      } catch (copyErr) {
        if (__DEV__) {
          console.log('[fileUtils] Notice on copyAsync, proceeding with direct/fallback reading:', copyErr?.message);
        }
      }
    }

    // Attempt 1: FileSystem.readAsStringAsync
    try {
      base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (fsErr) {
      if (__DEV__) {
        console.log('[fileUtils] FileSystem.readAsStringAsync failed, falling back to fetch/blob:', fsErr?.message);
      }
    }

    // Attempt 2: React Native fetch + FileReader fallback (natively supports content:// and file://)
    if (!base64) {
      const response = await fetch(file.uri);
      const blob = await response.blob();

      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            const commaIndex = result.indexOf(',');
            resolve(commaIndex !== -1 ? result.substring(commaIndex + 1) : result);
          } else {
            reject(new Error('FileReader returned non-string data.'));
          }
        };
        reader.onerror = (readErr) => reject(readErr);
        reader.readAsDataURL(blob);
      });
    }

    if (!base64) {
      throw new Error('Could not extract file content.');
    }

    const dataUri = `data:${mimeType};base64,${base64}`;
    return {
      base64,
      mimeType,
      dataUri,
    };
  } finally {
    // Clean up temporary cache file if created
    if (tempCachedUri) {
      try {
        await FileSystem.deleteAsync(tempCachedUri, { idempotent: true });
      } catch (_) {
        // Silently ignore cache cleanup errors
      }
    }
  }
};
