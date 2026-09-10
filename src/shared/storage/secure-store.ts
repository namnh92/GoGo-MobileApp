import * as SecureStore from 'expo-secure-store'

// Keychain (iOS) / Keystore-backed EncryptedSharedPreferences (Android).
// Tokens live here only — never AsyncStorage, never a URL, never a log
// (RULE-SEC-002). Android warns above 2048 bytes per value, so credentials are
// stored one key each instead of a single JSON blob.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS)
  } catch {
    // A corrupted/undecryptable entry must not brick app start — treat as absent.
    return null
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS)
}

export async function deleteSecureItem(key: string, strict = false): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS)
  } catch (error) {
    if (strict) throw error
    // Already gone — deleting a missing key is not a failure.
  }
}

export async function setOrDeleteSecureItem(key: string, value: string | null | undefined): Promise<void> {
  if (value === null || value === undefined || value === '') {
    await deleteSecureItem(key)
    return
  }
  await setSecureItem(key, value)
}
