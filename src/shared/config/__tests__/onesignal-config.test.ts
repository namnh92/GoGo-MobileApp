import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

function configure(environment: string) {
  vi.stubEnv('EXPO_PUBLIC_ENV', environment)
  vi.stubEnv('ONESIGNAL_CONFIG_ENV', environment === 'stag' ? 'staging' : environment)
  vi.stubEnv('ONESIGNAL_APP_ID', '00000000-0000-4000-8000-000000000001')
  vi.stubEnv('ONESIGNAL_APNS_MODE', 'production')
  vi.stubEnv('TENJIN_CONFIG_ENV', environment === 'stag' ? 'staging' : environment)
  vi.stubEnv('TENJIN_IOS_SDK_KEY', 'test-ios')
  vi.stubEnv('TENJIN_ANDROID_SDK_KEY', 'test-android')
  vi.stubEnv('ONESIGNAL_REST_API_KEY', 'server-secret-must-not-ship')
  vi.stubEnv('ONESIGNAL_IDENTITY_VERIFICATION_KEY', 'signing-secret-must-not-ship')
}

describe('provider build contract', () => {
  it.each(['dev', 'stag', 'prod'])('uses identical validation and plugin setup for %s', async environment => {
    configure(environment)
    const { default: config } = await import('../../../../app.config')
    // Found by name, not by index: the position is incidental and broke the
    // moment another plugin was added, while what this guards — that every
    // flavour configures the OneSignal plugin identically — did not change.
    const plugins = config.plugins ?? []
    expect(plugins).toContainEqual([
      'onesignal-expo-plugin',
      { mode: 'production', iPhoneDeploymentTarget: '15.1' },
    ])

    // Ordering *is* load-bearing for the beta pin (NTF-APP-004): Expo composes
    // mods like middleware, so the last registered runs first, and the pin has
    // to run after onesignal-expo-plugin has written the extension target's
    // OneSignalXCFramework constraint in order to rewrite it. Registered the
    // wrong way round it silently no-ops and the iOS module stops compiling.
    const nameOf = (plugin: unknown) => (Array.isArray(plugin) ? plugin[0] : plugin)
    const betaPin = plugins.findIndex(p => nameOf(p) === './plugins/with-onesignal-identity-beta')
    const oneSignal = plugins.findIndex(p => nameOf(p) === 'onesignal-expo-plugin')
    expect(betaPin).toBeGreaterThanOrEqual(0)
    expect(betaPin).toBeLessThan(oneSignal)
    expect(config.extra?.oneSignalAppId).toBe(process.env.ONESIGNAL_APP_ID)
    expect(JSON.stringify(config)).not.toContain('secret-must-not-ship')
  })

  it.each(['dev', 'stag', 'prod'])('refuses missing config in %s', async environment => {
    configure(environment)
    vi.stubEnv('ONESIGNAL_APP_ID', '')
    await expect(import('../../../../app.config')).rejects.toThrow(/ONESIGNAL_APP_ID/)
  })

  it.each(['dev', 'stag', 'prod'])('refuses missing Tenjin keys in %s', async environment => {
    configure(environment)
    vi.stubEnv('TENJIN_ANDROID_SDK_KEY', '')
    await expect(import('../../../../app.config')).rejects.toThrow(/TENJIN SDK keys/)
  })

  it('refuses cross-environment Tenjin config', async () => {
    configure('prod')
    vi.stubEnv('TENJIN_CONFIG_ENV', 'dev')
    await expect(import('../../../../app.config')).rejects.toThrow(/TENJIN_CONFIG_ENV/)
  })

  it('refuses cross-environment config', async () => {
    configure('prod')
    vi.stubEnv('ONESIGNAL_CONFIG_ENV', 'dev')
    await expect(import('../../../../app.config')).rejects.toThrow(/must match/)
  })
})
