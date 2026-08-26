import { NativeModules, Platform } from 'react-native';
import kvStorage from '../../data/kvStorage';

const { WidgetBridge } = NativeModules;
const localFileCache = new Map<string, string>();

export const imageResolver = {
  /**
   * Register or remove a local file URI for a key (storage path, image ID UUID, or local URI)
   */
  setLocalFileUri(key: string | null, fileUri: string | null): void {
    if (!key || !key.trim()) return;
    const trimmedKey = key.trim();
    if (fileUri && fileUri.trim()) {
      localFileCache.set(trimmedKey, fileUri.trim());
      kvStorage.setItem(`img_uri_${trimmedKey}`, fileUri.trim()).catch(() => {});
    } else {
      localFileCache.delete(trimmedKey);
      kvStorage.removeItem(`img_uri_${trimmedKey}`).catch(() => {});
    }
  },

  /**
   * Explicitly remove cached local file URI mapping for one or more keys (e.g. image UUID, storage path, member ID)
   */
  removeLocalFileUri(...keys: Array<string | null>): void {
    for (const key of keys) {
      if (key && key.trim()) {
        localFileCache.delete(key.trim());
        kvStorage.removeItem(`img_uri_${key.trim()}`).catch(() => {});
      }
    }
  },

  /**
   * Get previously resolved local file URI for a key from memory cache
   */
  getLocalFileUri(key: string): string | null {
    if (!key) return null;
    return localFileCache.get(key.trim()) || null;
  },

  /**
   * Synchronously resolve a storage path / image ID to a local displayable file URI.
   * Performs strictly local memory resolution. CONTAINS ZERO NETWORK CALLS.
   */
  resolveImageUriSync(
    rawUriOrId: string | null,
    storagePath: string | null
  ): string | null {
    if (!rawUriOrId && !storagePath) return null;

    const target = rawUriOrId ? rawUriOrId.trim() : '';

    // Direct local loadable URI check (file:// or content://)
    if (target.startsWith('file://') || target.startsWith('content://')) {
      return target;
    }

    if (storagePath && localFileCache.has(storagePath.trim())) {
      return localFileCache.get(storagePath.trim())!;
    }

    if (rawUriOrId && localFileCache.has(rawUriOrId.trim())) {
      return localFileCache.get(rawUriOrId.trim())!;
    }

    return null;
  },

  /**
   * Async local file resolution — checks Native WidgetBridge persistent disk cache.
   * CONTAINS ZERO NETWORK CALLS.
   */
  async resolveImageUri(
    rawUriOrId: string | null,
    storagePath: string | null
  ): Promise<string | null> {
    const syncRes = imageResolver.resolveImageUriSync(rawUriOrId, storagePath);
    if (syncRes) return syncRes;

    const sPath = storagePath ? storagePath.trim() : '';
    const rawId = rawUriOrId ? rawUriOrId.trim() : '';

    if (rawId.startsWith('file://') || rawId.startsWith('content://')) return rawId;

    if (rawId) {
      const kvVal = await kvStorage.getItem(`img_uri_${rawId}`);
      if (kvVal) {
        localFileCache.set(rawId, kvVal);
        return kvVal;
      }
    }
    if (sPath) {
      const kvVal = await kvStorage.getItem(`img_uri_${sPath}`);
      if (kvVal) {
        localFileCache.set(sPath, kvVal);
        return kvVal;
      }
    }

    if (Platform.OS === 'android' && WidgetBridge && WidgetBridge.getLocalMediaFile) {
      try {
        const pathToCheck = sPath || rawId;
        if (pathToCheck) {
          const localFile = await WidgetBridge.getLocalMediaFile(pathToCheck);
          if (localFile) {
            if (sPath) localFileCache.set(sPath, localFile);
            if (rawId) localFileCache.set(rawId, localFile);
            return localFile;
          }
        }
      } catch {}
    }

    return null;
  },
};

export default imageResolver;
