import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'

import { ACCENTS, DEFAULT_ACCENT, type Accent } from '@/shared/ui/theme'

/**
 * Where the "Màu chủ đề" choice lives (#293 §6): on the device, nothing
 * server-side. Same shape as `storage/onboarding.ts` — storage that cannot be
 * read or written must never cost the user the app, so every failure resolves
 * to the default accent.
 */
export const ACCENT_PREFERENCE_KEY = 'gogo.theme.accent.v1'

/** Storage is an untrusted boundary: a value from an older build, or a hand edit, is not an accent. */
export const accentSchema = z.enum(ACCENTS)

export async function readAccentPreference(): Promise<Accent> {
  return AsyncStorage.getItem(ACCENT_PREFERENCE_KEY)
    .then(value => {
      const parsed = accentSchema.safeParse(value)
      return parsed.success ? parsed.data : DEFAULT_ACCENT
    })
    .catch(() => DEFAULT_ACCENT)
}

export async function saveAccentPreference(accent: Accent): Promise<void> {
  await AsyncStorage.setItem(ACCENT_PREFERENCE_KEY, accent).catch(() => {})
}
