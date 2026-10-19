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

  it('every string is the owner-approved text, word for word (#366, 2026-10-19)', () => {
    // Changing any of these needs a new owner approval on #366 — not only a
    // matching edit in every copy.
    const APPROVED = {
      vi: {
        'consent.tracking.systemPrompt':
          'GoGo dùng mã quảng cáo của thiết bị để biết bạn cài app từ lời mời hay liên kết nào, và để đo hiệu quả các chiến dịch quảng cáo của GoGo. GoGo không hiển thị quảng cáo trong app.',
        'consent.tracking.title': 'Giúp GoGo biết bạn đến từ đâu',
        'consent.tracking.body':
          'Ở bước tiếp theo, iPhone sẽ hỏi bạn có cho GoGo theo dõi không. Nếu bạn cho phép, GoGo biết được lời mời hay liên kết nào đã đưa bạn đến, để mời thêm bạn bè dễ hơn. Từ chối thì mọi tính năng vẫn dùng bình thường, và bạn đổi lại được trong Cài đặt.',
        'consent.tracking.continue': 'Tiếp tục',
        'consent.tracking.later': 'Để sau',
      },
      en: {
        'consent.tracking.systemPrompt':
          "GoGo uses your device's advertising identifier to know which invite or link led you to install the app, and to measure how well GoGo's ad campaigns work. GoGo does not show ads in the app.",
        'consent.tracking.title': 'Help GoGo see where you came from',
        'consent.tracking.body':
          'Next, your iPhone will ask whether GoGo may track you. If you allow it, GoGo learns which invite or link brought you here, which helps it get better at bringing friends in. If you decline, every feature still works, and you can change this later in Settings.',
        'consent.tracking.continue': 'Continue',
        'consent.tracking.later': 'Not now',
      },
    } as const
    for (const [key, text] of Object.entries(APPROVED.vi)) expect(viMessages[key as keyof typeof viMessages]).toBe(text)
    for (const [key, text] of Object.entries(APPROVED.en)) expect(enMessages[key as keyof typeof enMessages]).toBe(text)
  })

  it('only the consent module imports the library, and nothing reads the identifier', () => {
    const files = sourceFiles('src')
    const importers = files.filter(path => readFileSync(path, 'utf8').includes("from 'expo-tracking-transparency'"))
    expect(importers).toEqual(['src/shared/consent/tracking.ts'])
    expect(files.filter(path => readFileSync(path, 'utf8').includes('getAdvertisingId'))).toEqual([])
  })
})
