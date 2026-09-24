import AsyncStorage from '@react-native-async-storage/async-storage'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ACCENT_PREFERENCE_KEY, readAccentPreference, saveAccentPreference } from '../accent-preference'

/**
 * #294 (#293 §6). The choice is local and survives a restart; anything that
 * is not one of the four keys — a value from a future build, an empty store,
 * a storage failure — resolves to the default rather than to an error, because
 * a colour preference must never keep the app from starting.
 */
afterEach(async () => {
  vi.restoreAllMocks()
  await AsyncStorage.clear()
})

describe('accent preference', () => {
  it('defaults to orange when nothing is stored', async () => {
    await expect(readAccentPreference()).resolves.toBe('orange')
  })

  it('round-trips each accent under the versioned key', async () => {
    for (const accent of ['green', 'blue', 'purple', 'orange'] as const) {
      await saveAccentPreference(accent)
      await expect(AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)).resolves.toBe(accent)
      await expect(readAccentPreference()).resolves.toBe(accent)
    }
  })

  it('treats a value that is not an accent as the default', async () => {
    await AsyncStorage.setItem(ACCENT_PREFERENCE_KEY, 'coral')
    await expect(readAccentPreference()).resolves.toBe('orange')
  })

  it('reads the default when storage throws, and swallows a failed write', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'))
    await expect(readAccentPreference()).resolves.toBe('orange')

    vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'))
    await expect(saveAccentPreference('blue')).resolves.toBeUndefined()
  })
})
