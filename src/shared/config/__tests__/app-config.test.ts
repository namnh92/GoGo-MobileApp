import type { ExpoConfig } from 'expo/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Loads the real `app.config.ts` — the artifact Expo evaluates — rather than a
 * copy of its logic. The identifier a build ships with is the one thing here
 * that cannot be fixed after an upload.
 */
async function loadConfig(flavor: string | undefined) {
  vi.resetModules()
  if (flavor === undefined) delete process.env.EXPO_PUBLIC_ENV
  else process.env.EXPO_PUBLIC_ENV = flavor
  const module = (await import('../../../../app.config')) as { default: ExpoConfig }
  return module.default
}

afterEach(() => {
  process.env.EXPO_PUBLIC_ENV = 'dev'
})

describe('app identity', () => {
  it.each([
    ['dev', 'max.gogo.dev', 'GoGo Dev', 'gogo-dev'],
    ['stag', 'max.gogo.stag', 'GoGo Staging', 'gogo-stag'],
    ['prod', 'max.gogo.prod', 'GoGo', 'gogo'],
  ])('%s builds as %s', async (flavor, bundleId, name, scheme) => {
    const config = await loadConfig(flavor)

    // iOS and Android must never drift apart: OneSignal, Tenjin and the store
    // listings are all configured per identifier, and two different strings
    // means two sets of everything.
    expect(config.ios?.bundleIdentifier).toBe(bundleId)
    expect(config.android?.package).toBe(bundleId)
    expect(config.name).toBe(name)
    expect(config.scheme).toBe(scheme)
    expect(config.extra?.flavor).toBe(flavor)
  })

  it('claims its own share host, and only where the host serves the files', async () => {
    const production = await loadConfig('prod')
    expect(production.ios?.associatedDomains).toEqual(['applinks:go.gogo.id.vn'])
    expect(production.android?.intentFilters).toHaveLength(1)

    // dev claims its own host, which serves association files naming
    // max.gogo.dev. Each flavour claims only itself: a build claiming another
    // environment's host could not verify there.
    const dev = await loadConfig('dev')
    expect(dev.ios?.associatedDomains).toEqual(['applinks:go-dev.gogo.id.vn'])
    expect(dev.android?.intentFilters?.[0]?.data).toEqual(
      ['/l', '/r', '/plans', '/places', '/room'].map((pathPrefix) => ({
        scheme: 'https',
        host: 'go-dev.gogo.id.vn',
        pathPrefix,
      })),
    )

    // stag has no host serving association files yet, so it asks for nothing:
    // an unverified handler in the Android chooser is worse than no handler.
    const staging = await loadConfig('stag')
    expect(staging.ios?.associatedDomains).toBeUndefined()
    expect(staging.android?.intentFilters).toBeUndefined()
  })

  it('refuses an unknown flavour instead of guessing one', async () => {
    // A near-miss like `production` for `prod` must fail the build, not ship a
    // store binary named "GoGo Dev".
    await expect(loadConfig('production')).rejects.toThrow(/EXPO_PUBLIC_ENV must be one of/)
  })

  it('falls back to development when nothing is set', async () => {
    const config = await loadConfig(undefined)
    expect(config.ios?.bundleIdentifier).toBe('max.gogo.dev')
  })
})

describe('iOS map provider (ADR 0005)', () => {
  afterEach(() => {
    delete process.env.GOOGLE_MAPS_IOS_API_KEY
  })

  it('hands a Google Maps key to the native plugin, and nowhere else', async () => {
    process.env.GOOGLE_MAPS_IOS_API_KEY = 'ios-key-under-test'
    const config = await loadConfig('dev')

    // Expo's react-native-maps plugin reads exactly this path.
    expect(config.ios?.config?.googleMapsApiKey).toBe('ios-key-under-test')
    // `extra` is embedded in the manifest JavaScript can read. The key is for
    // native code and must not travel there.
    expect(JSON.stringify(config.extra)).not.toContain('ios-key-under-test')
  })

  it('builds Apple Maps only when no key is set — including a blank placeholder', async () => {
    delete process.env.GOOGLE_MAPS_IOS_API_KEY
    expect((await loadConfig('dev')).ios?.config).toBeUndefined()

    // The line a developer copies from .env.example.
    process.env.GOOGLE_MAPS_IOS_API_KEY = '   '
    expect((await loadConfig('dev')).ios?.config).toBeUndefined()
  })
})
