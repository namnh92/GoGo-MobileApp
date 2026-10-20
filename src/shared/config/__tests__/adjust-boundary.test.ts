import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#367 (AC-A3, shape D1, rev 2 D5.4) — the Adjust boundary,
 * read from the source rather than asserted by a fake. An allowlist, not a
 * denylist (PR #369 Sol F-06): any Adjust API this app has not decided to use
 * — an external device id, global callback/partner parameters, events, ad
 * revenue, third-party sharing — fails here until someone decides it.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

const files = sourceFiles('src').map(path => ({ path, text: readFileSync(path, 'utf8') }))
const read = (path: string) => readFileSync(path, 'utf8')

/** `AdjustConfigLike` — the only config calls the initializer may make. */
const CONFIG_CALLS = [
  'disableDeferredDeeplinkOpening',
  'setAttConsentWaitingInterval',
  'setDeferredDeeplinkCallback',
  'setAttributionCallback',
]

describe('Adjust boundary', () => {
  it('only the acquisition bootstrap loads the SDK, and only lazily', () => {
    const loaders = files.filter(f => /(from|import\()\s*'react-native-adjust'/.test(f.text)).map(f => f.path)
    expect(loaders).toEqual(['src/shared/acquisition/bootstrap.ts'])
    const bootstrap = read('src/shared/acquisition/bootstrap.ts')
    expect(bootstrap).not.toMatch(/^import (?!type )[^\n]*'react-native-adjust'/m)
  })

  it('the bootstrap uses exactly Adjust.initSdk and the two environments', () => {
    const bootstrap = read('src/shared/acquisition/bootstrap.ts')
    expect([...new Set(bootstrap.match(/\bAdjust\.\w+/g) ?? [])].sort()).toEqual(['Adjust.initSdk'])
    expect([...new Set(bootstrap.match(/\bAdjustConfig\.\w+/g) ?? [])].sort()).toEqual([
      'AdjustConfig.EnvironmentProduction',
      'AdjustConfig.EnvironmentSandbox',
    ])
  })

  it('the initializer makes only the agreed config calls', () => {
    const init = read('src/shared/acquisition/adjust/initialize.ts')
    const calls = [...new Set((init.match(/\bconfig\.(\w+)\(/g) ?? []).map(m => m.slice(7, -1)))].sort()
    expect(calls).toEqual([...CONFIG_CALLS].sort())
  })

  it('nothing in the app calls an Adjust identity, event or payload API', () => {
    for (const call of [
      'trackEvent',
      'AdjustEvent',
      'setExternalDeviceId',
      'addGlobalCallbackParameter',
      'addGlobalPartnerParameter',
      'trackAdRevenue',
      'trackThirdPartySharing',
      'requestAppTrackingAuthorization',
      'disableAppTrackingTransparencyUsage',
      'disableIdfaReading',
    ]) {
      // Whole identifiers: `AdjustEvent` must not match the native module
      // name `AdjustEventEmitter` the preflight reads.
      const used = new RegExp(`\\b${call}\\b`)
      expect(files.filter(f => used.test(f.text)).map(f => f.path), call).toEqual([])
    }
  })
})
