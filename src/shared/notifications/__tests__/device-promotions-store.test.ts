import { describe, expect, it, vi } from 'vitest'

import { createDevicePromotionsStore, DEVICE_PROMOTIONS_DISCLOSURE } from '../device-promotions-store'

const record = (over: Record<string, unknown> = {}) => JSON.stringify({
  disclosure: { id: DEVICE_PROMOTIONS_DISCLOSURE, answer: 'accepted', at: '2026-11-04' },
  enabled: true, version: 1, pendingVersion: null, awaitingProviderOff: false,
  ...over,
})

function setup(raw: string | null = null) {
  let disk = raw
  const storage = {
    getItem: vi.fn(async () => disk),
    setItem: vi.fn(async (_key: string, value: string) => { disk = value }),
  }
  const store = createDevicePromotionsStore({ storage, timeoutMs: 20 })
  return { store, storage, disk: () => disk }
}

describe('retirement envelope', () => {
  it('family 3: nullable disclosure is absent, and legacy acceptance migrates', async () => {
    const empty = setup(record({ envelopeVersion: 1, disclosure: null, retirementOwed: true }))
    expect(await empty.store.load()).toMatchObject({ read: 'absent', answer: null, retirementOwed: true })
    const legacy = setup(record())
    expect(await legacy.store.load()).toMatchObject({ read: 'loaded', answer: 'accepted', retirementOwed: false })
    expect(JSON.parse(legacy.disk()!)).toMatchObject({ envelopeVersion: 1, retirementOwed: false })
  })

  it('family 3: obsolete wording keeps retirement metadata independently of the disclosure', async () => {
    const t = setup(record({ disclosure: { id: 'old-words', answer: 'accepted', at: 'x' }, retirementOwed: true }))
    expect(await t.store.load()).toMatchObject({ read: 'absent', answer: null, retirementOwed: true })
    await t.store.answer('accepted')
    expect(JSON.parse(t.disk()!)).toMatchObject({ retirementOwed: true })
  })

  it('family 5: failed preparation never publishes absent and retry prepares before answering', async () => {
    const t = setup()
    t.storage.setItem.mockRejectedValueOnce(new Error('disk'))
    expect(await t.store.load()).toMatchObject({ read: 'unreadable', save: 'unsaved', retirementOwed: true })
    await t.store.answer('accepted')
    expect(JSON.parse(t.disk()!)).toMatchObject({ disclosure: { answer: 'accepted' }, retirementOwed: true })
  })

  it('family 5: a refused read is unknown, never an absent record', async () => {
    const t = setup(record())
    t.storage.getItem.mockRejectedValue(new Error('disk'))
    expect(await t.store.load()).toMatchObject({ read: 'unreadable' })
    expect(await t.store.answer('accepted')).toBe(false)
    expect(t.storage.setItem).not.toHaveBeenCalled()
  })

  it('family 5: timeout does not release the write tail or overwrite newer answer and acknowledgement', async () => {
    const t = setup(record())
    await t.store.load()
    let finish!: () => void
    const write = t.storage.setItem.getMockImplementation()!
    t.storage.setItem.mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      finish = () => { void write(key, value).then(resolve) }
    }))
    const decline = t.store.answer('declined')
    await vi.waitFor(() => expect(finish).toBeDefined())
    expect(await decline).toBe(false)
    const accept = t.store.answer('accepted')
    const ack = t.store.acknowledge({ appliedVersion: 3, providerEnabled: true })
    await accept
    await ack
    expect(t.storage.setItem).toHaveBeenCalledTimes(2)
    expect(t.store.snapshot()).toMatchObject({ retirementOwed: true, save: 'unsaved' })
    finish()
    await vi.waitFor(() => expect(t.storage.setItem).toHaveBeenCalledTimes(4))
    expect(JSON.parse(t.disk()!)).toMatchObject({ disclosure: { answer: 'accepted' }, retirementOwed: true, pendingVersion: null })
  })

  it('family 5: a decline overtaking clearance preserves debt in the final envelope', async () => {
    const t = setup(record({ retirementOwed: true }))
    await t.store.load()
    let finish!: () => void
    const write = t.storage.setItem.getMockImplementation()!
    t.storage.setItem.mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      finish = () => { void write(key, value).then(resolve) }
    }))
    const clear = t.store.setRetirementOwed(false)
    await vi.waitFor(() => expect(finish).toBeDefined())
    const decline = t.store.answer('declined')
    const accept = t.store.answer('accepted')
    finish()
    await Promise.all([clear, decline, accept])
    await vi.waitFor(() => expect(JSON.parse(t.disk()!).retirementOwed).toBe(true))
    expect(t.store.snapshot().retirementOwed).toBe(true)
  })

  it('family 7: failed clearance stays owed and an eventual successful write clears durably', async () => {
    const t = setup(record({ retirementOwed: true }))
    await t.store.load()
    t.storage.setItem.mockRejectedValueOnce(new Error('disk'))
    expect(await t.store.setRetirementOwed(false)).toBe(false)
    expect(t.store.snapshot().retirementOwed).toBe(true)
    expect(JSON.parse(t.disk()!).retirementOwed).toBe(true)
    expect(await t.store.setRetirementOwed(false)).toBe(true)
    expect(JSON.parse(t.disk()!).retirementOwed).toBe(false)
  })

  it('family 8: preparation is shared and independent of SDK readiness', async () => {
    const t = setup()
    const [gate, settings, coordinator] = await Promise.all([t.store.load(), t.store.load(), t.store.load()])
    expect(gate).toBe(settings)
    expect(settings).toBe(coordinator)
    expect(t.storage.getItem).toHaveBeenCalledTimes(1)
    expect(t.storage.setItem).toHaveBeenCalledTimes(1)
    await t.store.answer('accepted')
    expect(JSON.parse(t.disk()!)).toMatchObject({ retirementOwed: true, disclosure: { answer: 'accepted' } })
  })

  it('saved() answers for a healthy write still in flight, and reports a refused one', async () => {
    const { store, storage } = setup()
    await store.load()
    let release!: () => void
    storage.setItem.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const answered = store.answer('accepted')
    const saved = store.saved()
    await vi.waitFor(() => expect(release).toBeDefined(), { interval: 1 })
    release()
    expect(await answered).toBe(true)
    expect(await saved).toBe(true)

    storage.setItem.mockRejectedValueOnce(new Error('disk'))
    expect(await store.answer('declined')).toBe(false)
    expect(await store.saved()).toBe(false)
  })
})
