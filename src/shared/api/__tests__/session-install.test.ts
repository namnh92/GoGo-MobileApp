import { beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as secure from '@/shared/storage/secure-store'
vi.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>()
  return { default: { getItem: vi.fn(async (key: string) => data.get(key) ?? null), setItem: async (key: string, value: string) => { data.set(key, value) }, clear: async () => data.clear() } }
})
vi.mock('@/shared/storage/secure-store', () => {
  const data = new Map<string, string>()
  return { getSecureItem: async (key: string) => data.get(key) ?? null, setSecureItem: async (key: string, value: string) => { data.set(key, value) }, deleteSecureItem: async (key: string) => { data.delete(key) }, setOrDeleteSecureItem: vi.fn() }
})

const session = { kind: 'user' as const, accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 60000 }

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await AsyncStorage.clear()
  for (const key of ['access_token', 'refresh_token', 'guest_token', 'session_meta']) await secure.deleteSecureItem(`gogo.${key}`)
})

describe('installation-scoped session', () => {
  it('discards credentials surviving an uninstall', async () => {
    await secure.setSecureItem('gogo.access_token', 'old-access')
    await secure.setSecureItem('gogo.refresh_token', 'old-refresh')
    await secure.setSecureItem('gogo.session_meta', JSON.stringify({ kind: 'user', expiresAt: session.expiresAt }))
    const api = await import('../session')
    expect(await Promise.all([api.hydrateSession(), api.hydrateSession()])).toEqual([null, null])
    expect(await secure.getSecureItem('gogo.refresh_token')).toBeNull()
    expect(await AsyncStorage.getItem('gogo.install.v1')).toBe('1')
  })

  it('restores a login on ordinary relaunch', async () => {
    await AsyncStorage.setItem('gogo.install.v1', '1')
    await secure.setSecureItem('gogo.access_token', session.accessToken)
    await secure.setSecureItem('gogo.refresh_token', session.refreshToken)
    await secure.setSecureItem('gogo.session_meta', JSON.stringify({ kind: 'user', expiresAt: session.expiresAt }))
    const api = await import('../session')
    expect(await api.hydrateSession()).toMatchObject(session)
  })

  it('does not restore an account when installation storage fails', async () => {
    const api = await import('../session')
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'))
    expect(await api.hydrateSession()).toBeNull()
    expect(api.isHydrated()).toBe(true)
  })
})
