import type { ExpoConfig } from 'expo/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Loads the real `app.config.ts` — the artifact Expo evaluates — rather than a
 * copy of its logic. The identifier a build ships with is the one thing here
 * that cannot be fixed after an upload.
 */
/**
 * `sentryDsn` defaults to what CI passes: nothing on dev, `off` on stag/prod
 * (GoGo-MobileApp#336). Set on every call, so no case inherits the previous
 * case's value.
 */
async function loadConfig(
  flavor: string | undefined,
  sentryDsn?: string,
  adjust: { ios?: string; android?: string; env?: string | null } = {},
) {
  vi.resetModules()
  // GoGo-MobileApp#367: like the DSN — nothing on dev, `off` on stag/prod.
  const adjustDefault = flavor === 'stag' || flavor === 'prod' ? 'off' : ''
  process.env.ADJUST_IOS_APP_TOKEN = adjust.ios ?? adjustDefault
  process.env.ADJUST_ANDROID_APP_TOKEN = adjust.android ?? adjustDefault
  // The marker is unconditional (PR #369 Sol F-04); `null` leaves it unset.
  const marker = adjust.env === undefined ? (flavor === 'stag' ? 'staging' : (flavor ?? 'dev')) : adjust.env
  if (marker === null) delete process.env.ADJUST_CONFIG_ENV
  else process.env.ADJUST_CONFIG_ENV = marker
  const dsn = sentryDsn ?? (flavor === 'stag' || flavor === 'prod' ? 'off' : undefined)
  if (dsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN
  else process.env.EXPO_PUBLIC_SENTRY_DSN = dsn
  if (flavor === undefined) delete process.env.EXPO_PUBLIC_ENV
  else process.env.EXPO_PUBLIC_ENV = flavor
  process.env.GOOGLE_MAPS_IOS_API_KEY ??= 'ios-key-under-test'
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ??= 'android-key-under-test'
  process.env.ONESIGNAL_APP_ID = '00000000-0000-4000-8000-000000000001'
  process.env.ONESIGNAL_CONFIG_ENV = flavor === 'stag' ? 'staging' : (flavor ?? 'dev')
  process.env.ONESIGNAL_APNS_MODE = 'production'
  process.env.TENJIN_CONFIG_ENV = flavor === 'stag' ? 'staging' : (flavor ?? 'dev')
  process.env.TENJIN_IOS_SDK_KEY = 'test-ios'
  process.env.TENJIN_ANDROID_SDK_KEY = 'test-android'
  const module = (await import('../../../../app.config')) as { default: ExpoConfig }
  return module.default
}

afterEach(() => {
  process.env.EXPO_PUBLIC_ENV = 'dev'
  delete process.env.EXPO_PUBLIC_SENTRY_DSN
  delete process.env.ADJUST_IOS_APP_TOKEN
  delete process.env.ADJUST_ANDROID_APP_TOKEN
  delete process.env.ADJUST_CONFIG_ENV
})

describe('Adjust app tokens (GoGo-MobileApp#367, AC-A1)', () => {
  const TOKEN = 'abcdEFGH1234'

  it('dev resolves with both tokens empty', async () => {
    const config = await loadConfig('dev')
    expect(config.extra).toMatchObject({ adjustIosAppToken: '', adjustAndroidAppToken: '' })
  })

  it.each(['stag', 'prod'])('%s refuses an empty token', async flavor => {
    await expect(loadConfig(flavor, undefined, { ios: '' })).rejects.toThrow(/ADJUST_IOS_APP_TOKEN is required/)
    await expect(loadConfig(flavor, undefined, { android: '' })).rejects.toThrow(/ADJUST_ANDROID_APP_TOKEN is required/)
  })

  it.each(['stag', 'prod'])('%s accepts off, or a token bound to its environment', async flavor => {
    await expect(loadConfig(flavor)).resolves.toBeDefined()
    const env = flavor === 'stag' ? 'staging' : flavor
    const config = await loadConfig(flavor, undefined, { ios: TOKEN, android: 'off', env })
    expect(config.extra).toMatchObject({ adjustIosAppToken: TOKEN, adjustAndroidAppToken: 'off' })
  })

  it('ADJUST_CONFIG_ENV must match, whatever the tokens — a DEV file cannot ride into prod', async () => {
    await expect(loadConfig('prod', undefined, { ios: TOKEN, android: TOKEN, env: 'dev' })).rejects.toThrow(/ADJUST_CONFIG_ENV/)
    await expect(loadConfig('prod', undefined, { env: null })).rejects.toThrow(/ADJUST_CONFIG_ENV/)
    await expect(loadConfig('stag', undefined, { env: 'prod' })).rejects.toThrow(/ADJUST_CONFIG_ENV/)
    await expect(loadConfig('dev', undefined, { env: null })).rejects.toThrow(/ADJUST_CONFIG_ENV/)
    await expect(loadConfig('dev', undefined, { ios: TOKEN, android: TOKEN, env: 'dev' })).resolves.toBeDefined()
  })

  it.each(['OFF', 'abc', 'a'.repeat(33), 'abc def12'])('refuses %s as a token', async value => {
    await expect(loadConfig('dev', undefined, { ios: value, env: 'dev' })).rejects.toThrow(/ADJUST_IOS_APP_TOKEN/)
  })

  it('extra carries the two tokens and no other Adjust value', async () => {
    const config = await loadConfig('dev', undefined, { ios: TOKEN, android: TOKEN, env: 'dev' })
    const keys = Object.keys(config.extra ?? {}).filter(key => /adjust/i.test(key))
    expect(keys.sort()).toEqual(['adjustAndroidAppToken', 'adjustIosAppToken'])
  })
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

  it.each(['GOOGLE_MAPS_IOS_API_KEY', 'GOOGLE_MAPS_ANDROID_API_KEY'])('rejects a blank %s', async key => {
    process.env[key] = '   '
    await expect(loadConfig('dev')).rejects.toThrow(/required for Expo commands and native builds/)
    delete process.env[key]
  })

  it('embeds the Android key only in native configuration', async () => {
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = 'android-key-under-test'
    const config = await loadConfig('dev')
    expect(config.android?.config?.googleMaps?.apiKey).toBe('android-key-under-test')
    expect(config.android?.allowBackup).toBe(false)
    expect(JSON.stringify(config.extra)).not.toContain('android-key-under-test')
  })
})

describe('iOS development team (GoGo-MobileApp#166)', () => {
  afterEach(() => {
    delete process.env.APPLE_TEAM_ID
  })

  it('sets ios.appleTeamId from APPLE_TEAM_ID, so prebuild writes DEVELOPMENT_TEAM', async () => {
    process.env.APPLE_TEAM_ID = ' ABCDE12345 '
    const config = await loadConfig('dev')
    // Expo's DevelopmentTeam mod applies this to every native target,
    // the notification service extension included.
    expect(config.ios?.appleTeamId).toBe('ABCDE12345')
  })

  it.each([undefined, '', '   '])('leaves ios.appleTeamId unset when APPLE_TEAM_ID is %j', async value => {
    if (value !== undefined) process.env.APPLE_TEAM_ID = value
    const config = await loadConfig('dev')
    expect(config.ios).not.toHaveProperty('appleTeamId')
  })

  it('rejects a value that is not a 10-character Apple team id', async () => {
    process.env.APPLE_TEAM_ID = 'undefined'
    await expect(loadConfig('dev')).rejects.toThrow(/APPLE_TEAM_ID/)
  })
})

describe('crash reporting decision (GoGo-MobileApp#336, ADR-0011 D-3)', () => {
  const DSN = 'https://0123456789abcdef0123456789abcdef@o0.ingest.us.sentry.io/4512252504178688'

  it.each(['stag', 'prod'])('%s refuses a build that states no decision', async flavor => {
    await expect(loadConfig(flavor, '')).rejects.toThrow(/EXPO_PUBLIC_SENTRY_DSN is required for/)
  })

  it.each(['stag', 'prod'])('%s accepts the literal off or a DSN', async flavor => {
    await expect(loadConfig(flavor, 'off')).resolves.toBeDefined()
    await expect(loadConfig(flavor, DSN)).resolves.toBeDefined()
  })

  it.each([
    ['prod', 'OFF'],
    ['prod', 'Off'],
    ['stag', 'false'],
    ['stag', '0'],
    ['prod', 'not-a-dsn'],
    ['prod', 'https://k@o0.ingest.us.sentry.io:99999/1'],
    ['prod', 'https://k@o0.ingest.us.sentry.io/abc'],
    ['prod', 'ftp://k@o0.ingest.us.sentry.io/1'],
    ['dev', 'OFF'],
  ])('%s refuses %s — one spelling of off', async (flavor, value) => {
    await expect(loadConfig(flavor, value)).rejects.toThrow(/EXPO_PUBLIC_SENTRY_DSN/)
  })

  it('dev may be empty', async () => {
    await expect(loadConfig('dev', '')).resolves.toBeDefined()
    await expect(loadConfig('dev')).resolves.toBeDefined()
  })

  it('never puts the DSN into the native config', async () => {
    const config = await loadConfig('prod', DSN)
    expect(JSON.stringify(config)).not.toContain('0123456789abcdef0123456789abcdef')
  })

  // GoGo-MobileApp#340, ADR-0011 D-5 phase 2. Expo serializes every `plugins`
  // entry, options included, into the public config embedded in the binary
  // (EXConstants.bundle/app.config) and served by the dev server, so the Sentry
  // plugin is registered through a local wrapper that holds the coordinates.
  it.each(['dev', 'stag', 'prod'])('%s registers Sentry through the wrapper and ships no coordinates', async flavor => {
    const config = await loadConfig(flavor)
    const names = (config.plugins ?? []).map(plugin => (Array.isArray(plugin) ? plugin[0] : plugin))
    expect(names).toContain('./plugins/with-sentry-uploads.js')
    expect(names).not.toContain('@sentry/react-native/expo')
    expect(JSON.stringify(config)).not.toMatch(/gogo-vn|gogo-mobile|sentry\.io/)
  })

  // The wrapper's options become ios/ and android/ `sentry.properties`: a token
  // among them would sit in the native project of every build, and
  // `disableAutoUpload` would bake a fixed answer into build.gradle instead of
  // letting `scripts/release-build.sh` decide.
  it('the wrapper passes project coordinates only', async () => {
    const plugin = (await import('../../../../plugins/with-sentry-uploads.js')) as {
      SENTRY_UPLOAD_TARGET: Record<string, string>
    }
    expect(plugin.SENTRY_UPLOAD_TARGET).toEqual({
      organization: 'gogo-vn',
      project: 'gogo-mobile',
      url: 'https://sentry.io/',
    })
  })
})
