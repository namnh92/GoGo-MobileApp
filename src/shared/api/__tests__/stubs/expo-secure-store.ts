// In-memory stand-in for the Keychain/Keystore module so the real client code
// can run under Node during the contract smoke test.
const store = new Map<string, string>()

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'whenUnlockedThisDeviceOnly'

export interface SecureStoreOptions {
  keychainAccessible?: string
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key)
}
