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
  process.env.EXPO_PUBLIC_ENV = 'development'
})

describe('app identity', () => {
  it.each([
    ['development', 'max.gogo.development', 'GoGo Dev', 'gogo-dev'],
    ['staging', 'max.gogo.staging', 'GoGo Staging', 'gogo-staging'],
    ['production', 'max.gogo.production', 'GoGo', 'gogo'],
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

  it('claims gogo.app links from production only', async () => {
    const production = await loadConfig('production')
    expect(production.ios?.associatedDomains).toEqual(['applinks:gogo.app'])
    expect(production.android?.intentFilters).toHaveLength(1)

    // A dev build cannot verify against a domain whose assetlinks never names
    // it, so it does not ask: an unverified handler in the Android chooser is
    // worse than no handler.
    for (const flavor of ['development', 'staging']) {
      const config = await loadConfig(flavor)
      expect(config.ios?.associatedDomains).toBeUndefined()
      expect(config.android?.intentFilters).toBeUndefined()
    }
  })

  it('refuses an unknown flavour instead of guessing one', async () => {
    // A typo in a CI variable must fail the build, not ship a store binary
    // named "GoGo Dev".
    await expect(loadConfig('prod')).rejects.toThrow(/EXPO_PUBLIC_ENV must be one of/)
  })

  it('falls back to development when nothing is set', async () => {
    const config = await loadConfig(undefined)
    expect(config.ios?.bundleIdentifier).toBe('max.gogo.development')
  })
})
