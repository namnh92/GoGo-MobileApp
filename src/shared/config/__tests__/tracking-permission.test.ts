import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { ExpoConfig } from 'expo/config'
import { describe, expect, it, vi } from 'vitest'

import { enMessages } from '@/shared/i18n/en'
import { viMessages } from '@/shared/i18n/vi'

/**
 * GoGo-MobileApp#366 (AC-A2.1, AC-A2.3) — the words iOS shows in the tracking
 * dialog are the owner's, in one place each: the plugin option, the
 * per-language plist files and the i18n key must stay the same text. And the
 * app itself never reads the advertising identifier: the MMP SDKs do, once the
 * OS allows it.
 */

async function config(): Promise<ExpoConfig> {
  vi.resetModules()
  process.env.EXPO_PUBLIC_ENV = 'dev'
  process.env.GOOGLE_MAPS_IOS_API_KEY ??= 'ios-key-under-test'
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ??= 'android-key-under-test'
  process.env.ONESIGNAL_APP_ID = '00000000-0000-4000-8000-000000000001'
  process.env.ONESIGNAL_CONFIG_ENV = 'dev'
  process.env.ONESIGNAL_APNS_MODE = 'production'
  process.env.TENJIN_CONFIG_ENV = 'dev'
  process.env.TENJIN_IOS_SDK_KEY = 'test-ios'
  process.env.TENJIN_ANDROID_SDK_KEY = 'test-android'
  return ((await import('../../../../app.config')) as { default: ExpoConfig }).default
}

function plist(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

describe('tracking permission string', () => {
  it('the plugin carries the Vietnamese key word for word', async () => {
    const plugin = ((await config()).plugins ?? []).find(
      entry => Array.isArray(entry) && entry[0] === 'expo-tracking-transparency',
    ) as [string, { userTrackingPermission?: string }] | undefined
    expect(plugin, 'expo-tracking-transparency must stay registered with its string').toBeDefined()
    expect(plugin![1].userTrackingPermission).toBe(viMessages['consent.tracking.systemPrompt'])
  })

  it('each language file matches its i18n key, and both are registered', async () => {
    expect((await config()).locales).toEqual({ vi: './locales/vi.json', en: './locales/en.json' })
    expect(plist('locales/vi.json').NSUserTrackingUsageDescription).toBe(viMessages['consent.tracking.systemPrompt'])
    expect(plist('locales/en.json').NSUserTrackingUsageDescription).toBe(enMessages['consent.tracking.systemPrompt'])
  })

  it('names the purpose Apple reviews', () => {
    expect(viMessages['consent.tracking.systemPrompt']).toContain('chiến dịch quảng cáo')
    expect(enMessages['consent.tracking.systemPrompt']).toContain('ad campaigns')
  })

  it('only the consent module imports the library, and nothing reads the identifier', () => {
    const files = sourceFiles('src')
    const importers = files.filter(path => readFileSync(path, 'utf8').includes("from 'expo-tracking-transparency'"))
    expect(importers).toEqual(['src/shared/consent/tracking.ts'])
    expect(files.filter(path => readFileSync(path, 'utf8').includes('getAdvertisingId'))).toEqual([])
  })
})
