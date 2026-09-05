import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

function configure(environment: string) {
  vi.stubEnv('EXPO_PUBLIC_ENV', environment)
  vi.stubEnv('ONESIGNAL_CONFIG_ENV', environment === 'stag' ? 'staging' : environment)
  vi.stubEnv('ONESIGNAL_APP_ID', '00000000-0000-4000-8000-000000000001')
  vi.stubEnv('ONESIGNAL_APNS_MODE', 'production')
  vi.stubEnv('ONESIGNAL_REST_API_KEY', 'server-secret-must-not-ship')
  vi.stubEnv('ONESIGNAL_IDENTITY_VERIFICATION_KEY', 'signing-secret-must-not-ship')
}

describe('OneSignal build contract', () => {
  it.each(['dev', 'stag', 'prod'])('uses identical validation and plugin setup for %s', async environment => {
    configure(environment)
    const { default: config } = await import('../../../../app.config')
    expect(config.plugins?.[0]).toEqual(['onesignal-expo-plugin', { mode: 'production', iPhoneDeploymentTarget: '15.1' }])
    expect(config.extra?.oneSignalAppId).toBe(process.env.ONESIGNAL_APP_ID)
    expect(JSON.stringify(config)).not.toContain('secret-must-not-ship')
  })

  it.each(['dev', 'stag', 'prod'])('refuses missing config in %s', async environment => {
    configure(environment)
    vi.stubEnv('ONESIGNAL_APP_ID', '')
    await expect(import('../../../../app.config')).rejects.toThrow(/ONESIGNAL_APP_ID/)
  })

  it('refuses cross-environment config', async () => {
    configure('prod')
    vi.stubEnv('ONESIGNAL_CONFIG_ENV', 'dev')
    await expect(import('../../../../app.config')).rejects.toThrow(/must match/)
  })
})
