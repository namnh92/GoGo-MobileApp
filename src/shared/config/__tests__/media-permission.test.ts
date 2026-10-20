import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { ExpoConfig } from 'expo/config'
import { describe, expect, it, vi } from 'vitest'

/**
 * One permission, two screens, one string.
 *
 * iOS asks for the photo library once and shows `NSPhotoLibraryUsageDescription`
 * whichever screen triggered it, and Apple refuses a purpose string that does
 * not cover every use (App Review 5.1.1). The string shipped for a while naming
 * only check-in while the avatar picker requested the same permission
 * (GoGo-MobileApp#356, found while writing `docs/store-privacy.md`) — a review
 * found it, not a test, because nothing tied the callers to the string.
 *
 * So this is the tie: every call site is registered here with the word its
 * purpose must appear as in the string. A third caller fails this test until
 * both the registry and the purpose string account for it.
 */
const PERMISSION_CALL = 'requestMediaLibraryPermissionsAsync'

/** Call site → a word the purpose string must contain for that use. */
const CALLERS: Record<string, string> = {
  'src/features/active-date/checkin-sheet.view.tsx': 'check-in',
  'src/shared/media/pick-avatar.ts': 'đại diện',
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

async function photosPermission(): Promise<string> {
  vi.resetModules()
  process.env.EXPO_PUBLIC_ENV = 'dev'
  process.env.GOOGLE_MAPS_IOS_API_KEY ??= 'ios-key-under-test'
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ??= 'android-key-under-test'
  process.env.ONESIGNAL_APP_ID = '00000000-0000-4000-8000-000000000001'
  process.env.ONESIGNAL_CONFIG_ENV = 'dev'
  process.env.ONESIGNAL_APNS_MODE = 'production'
  process.env.TENJIN_CONFIG_ENV = 'dev'
  process.env.ADJUST_CONFIG_ENV = 'dev'
  process.env.TENJIN_IOS_SDK_KEY = 'test-ios'
  process.env.TENJIN_ANDROID_SDK_KEY = 'test-android'
  const { default: config } = (await import('../../../../app.config')) as { default: ExpoConfig }
  const plugin = (config.plugins ?? []).find(
    entry => Array.isArray(entry) && entry[0] === 'expo-image-picker',
  ) as [string, { photosPermission?: string }] | undefined
  expect(plugin, 'expo-image-picker must stay registered with its options').toBeDefined()
  const permission = plugin![1]?.photosPermission
  expect(typeof permission, 'photosPermission must be set explicitly').toBe('string')
  return permission as string
}

describe('photo library permission', () => {
  it('registers every call site that asks for the library', () => {
    const found = sourceFiles('src')
      .filter(path => readFileSync(path, 'utf8').includes(PERMISSION_CALL))
      .sort()
    expect(found).toEqual(Object.keys(CALLERS).sort())
  })

  it('names every registered purpose in the string Apple shows', async () => {
    const permission = await photosPermission()
    for (const [path, purpose] of Object.entries(CALLERS)) {
      expect(permission, `${path} asks for the library for "${purpose}"`).toContain(purpose)
    }
  })
})
