import { describe, expect, it, vi } from 'vitest'
import { createOnboardingPermissionStore, ONBOARDING_PERMISSION_KEY } from './onboarding-permission-store'

function storageWith(value: string | null = null) {
  const disk = new Map<string, string>(value ? [[ONBOARDING_PERMISSION_KEY, value]] : [])
  return {
    disk,
    getItem: vi.fn(async (key: string) => disk.get(key) ?? null),
    setItem: vi.fn(async (key: string, next: string) => { disk.set(key, next) }),
  }
}

describe('Start intent storage across fresh instances', () => {
  it('pending survives restart and consumed stays consumed', async () => {
    const storage = storageWith()
    const first = createOnboardingPermissionStore(storage)
    await first.defer()
    const restarted = createOnboardingPermissionStore(storage)
    await restarted.load()
    expect(restarted.snapshot()).toBe(true)
    await restarted.consume(restarted.claim()!)
    const nextLaunch = createOnboardingPermissionStore(storage)
    await nextLaunch.load()
    expect(nextLaunch.snapshot()).toBe(false)
    expect(nextLaunch.claim()).toBeUndefined()
  })
  it('delayed hydration cannot overwrite a newer defer', async () => {
    const storage = storageWith('consumed')
    let read!: (value: string | null) => void
    storage.getItem.mockImplementationOnce(() => new Promise(resolve => { read = resolve }))
    const store = createOnboardingPermissionStore(storage)
    const hydration = store.load()
    await store.defer()
    read('consumed')
    await hydration
    expect(store.snapshot()).toBe(true)
    const restarted = createOnboardingPermissionStore(storage)
    await restarted.load()
    expect(restarted.snapshot()).toBe(true)
  })
  it('claims synchronously once and preserves a newer intent during consumption', async () => {
    const store = createOnboardingPermissionStore(storageWith())
    await store.defer()
    const token = store.claim()!
    expect(store.claim()).toBeUndefined()
    await store.defer()
    await store.consume(token)
    expect(store.snapshot()).toBe(true)
    expect(store.claim()).not.toBeUndefined()
  })
  it('serializes pending then consumed writes even with slow storage', async () => {
    const storage = storageWith()
    let finish!: () => void
    storage.setItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const store = createOnboardingPermissionStore(storage)
    const pendingWrite = store.defer()
    const consumedWrite = store.consume(store.claim()!)
    await Promise.resolve()
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    finish()
    await Promise.all([pendingWrite, consumedWrite])
    expect(storage.setItem.mock.calls.map(call => call[1])).toEqual(['pending', 'consumed'])
    expect(storage.disk.get(ONBOARDING_PERMISSION_KEY)).toBe('consumed')
  })
})

describe('best-effort persistence limitations (errors are swallowed)', () => {
  it('failed pending writes retain launch intent but can lose it on restart', async () => {
    const storage = storageWith()
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'))
    const store = createOnboardingPermissionStore(storage)
    await expect(store.defer()).resolves.toBeUndefined()
    expect(store.snapshot()).toBe(true)
    const restarted = createOnboardingPermissionStore(storage)
    await restarted.load()
    expect(restarted.snapshot()).toBe(false)
  })
  it('failed consumed writes prevent launch replay but can replay on restart', async () => {
    const storage = storageWith()
    const store = createOnboardingPermissionStore(storage)
    await store.defer()
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(store.consume(store.claim()!)).resolves.toBeUndefined()
    expect(store.snapshot()).toBe(false)
    expect(store.claim()).toBeUndefined()
    const restarted = createOnboardingPermissionStore(storage)
    await restarted.load()
    expect(restarted.snapshot()).toBe(true)
  })
  it('a failed write does not poison later writes', async () => {
    const storage = storageWith()
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'))
    const store = createOnboardingPermissionStore(storage)
    await store.defer()
    await store.consume(store.claim()!)
    expect(storage.disk.get(ONBOARDING_PERMISSION_KEY)).toBe('consumed')
  })
})
