import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CONSENT_DISCLOSURE,
  CONSENT_STORAGE_KEY,
  CONSENT_STORE_TIMEOUT_MS,
  createConsentStore,
  type ConsentStorage,
} from '../consent-store'

/**
 * GoGo-MobileApp#370 (shape D2, Astra A-F-02) — runtime first, every call
 * bounded, a stale mutation does nothing, `saved` means saved. The fake storage
 * hands each call's completion to the test, so "late", "never" and "out of
 * order" are each exactly what they say.
 */

type Call = { op: 'get' | 'set' | 'remove'; value?: string; resolve: (raw?: string | null) => void; reject: () => void }

function controlled(disk = new Map<string, string>()) {
  const calls: Call[] = []
  const pending = <T,>(op: Call['op'], value?: string, apply?: () => T) =>
    new Promise<T>((resolve, reject) => {
      calls.push({
        op,
        value,
        resolve: raw => resolve((op === 'get' ? (raw === undefined ? disk.get(CONSENT_STORAGE_KEY) ?? null : raw) : apply?.()) as T),
        reject: () => reject(new Error('storage')),
      })
    })
  const storage: ConsentStorage = {
    getItem: () => pending<string | null>('get'),
    setItem: (_key, value) => pending<void>('set', value, () => void disk.set(CONSENT_STORAGE_KEY, value)),
    removeItem: () => pending<void>('remove', undefined, () => void disk.delete(CONSENT_STORAGE_KEY)),
  }
  return { storage, calls, disk }
}

/** A storage that simply works. */
function working(disk = new Map<string, string>()): ConsentStorage {
  return {
    getItem: async () => disk.get(CONSENT_STORAGE_KEY) ?? null,
    setItem: async (_key, value) => void disk.set(CONSENT_STORAGE_KEY, value),
    removeItem: async () => void disk.delete(CONSENT_STORAGE_KEY),
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const record = (status: string, disclosure = CONSENT_DISCLOSURE) =>
  JSON.stringify({ status, at: '2026-11-02T00:00:00.000Z', disclosure })

afterEach(() => vi.useRealTimers())

describe('reading', () => {
  it('round trip: an answer is read back by the next launch', async () => {
    const disk = new Map<string, string>()
    const first = createConsentStore({ storage: working(disk), now: () => new Date('2026-11-02T01:02:03.000Z') })
    first.set('denied')
    await flush()
    expect(first.snapshot().save).toBe('saved')
    expect(JSON.parse(disk.get(CONSENT_STORAGE_KEY)!)).toEqual({
      status: 'denied',
      at: '2026-11-02T01:02:03.000Z',
      disclosure: CONSENT_DISCLOSURE,
    })
    expect(await createConsentStore({ storage: working(disk) }).load()).toBe('denied')
  })

  it.each([
    ['nothing stored', null],
    ['invalid JSON', '{not json'],
    ['a value that is not an answer', record('maybe')],
    ['another wording', record('granted', 'android-consent-v0')],
    ['missing fields', JSON.stringify({ status: 'granted' })],
  ])('%s is undetermined', async (_label, raw) => {
    const disk = new Map<string, string>(raw === null ? [] : [[CONSENT_STORAGE_KEY, raw]])
    const store = createConsentStore({ storage: working(disk) })
    expect(await store.load()).toBe('undetermined')
    expect(store.snapshot().loaded).toBe(true)
  })

  it('a read that rejects, or throws, is undetermined', async () => {
    const rejects = createConsentStore({ storage: { ...working(), getItem: () => Promise.reject(new Error('x')) } })
    expect(await rejects.load()).toBe('undetermined')
    const throws = createConsentStore({ storage: { ...working(), getItem: () => { throw new Error('x') } } })
    expect(await throws.load()).toBe('undetermined')
  })

  it('a read that never answers is undetermined after the bound, and a late one is dropped', async () => {
    vi.useFakeTimers()
    const { storage, calls } = controlled(new Map([[CONSENT_STORAGE_KEY, record('granted')]]))
    const store = createConsentStore({ storage })
    const read = store.load()
    await vi.advanceTimersByTimeAsync(CONSENT_STORE_TIMEOUT_MS)
    expect(await read).toBe('undetermined')
    calls[0].resolve()
    await flush()
    expect(store.get()).toBe('undetermined')
  })

  it('an answer made while reading beats what the read finds', async () => {
    const { storage, calls } = controlled(new Map([[CONSENT_STORAGE_KEY, record('granted')]]))
    const store = createConsentStore({ storage })
    const read = store.load()
    store.set('denied')
    calls[0].resolve()
    expect(await read).toBe('denied')
    expect(store.get()).toBe('denied')
  })

  it('reads once per process', async () => {
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage })
    void store.load()
    void store.load()
    expect(calls.filter(c => c.op === 'get')).toHaveLength(1)
    calls[0].resolve()
  })
})

describe('deciding', () => {
  it('runtime first: the value changes and the write is issued in the same tick', () => {
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage })
    store.set('denied')
    expect(store.get()).toBe('denied')
    expect(store.generation()).toBe(1)
    expect(store.snapshot().save).toBe('saving')
    expect(calls.map(c => c.op)).toEqual(['set'])
  })

  it('a stalled write never blocks a later one from being issued', () => {
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage })
    store.set('granted')
    store.set('denied')
    expect(calls.map(c => JSON.parse(c.value!).status)).toEqual(['granted', 'denied'])
    expect(store.get()).toBe('denied')
  })

  it('a grant whose write fails: granted now, unsaved, nothing on disk for next launch', async () => {
    const events: string[] = []
    const disk = new Map<string, string>()
    const store = createConsentStore({
      storage: { ...working(disk), setItem: () => Promise.reject(new Error('full')) },
      report: e => events.push(e),
    })
    store.set('granted')
    await flush()
    expect(store.get()).toBe('granted')
    expect(store.snapshot().save).toBe('unsaved')
    expect(events).toEqual(['consent_tracking:store_failed:granted'])
    expect(await createConsentStore({ storage: working(disk) }).load()).toBe('undetermined')
  })

  it('a grant whose write stalls is unsaved at the bound, and late is still not saved', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage, report: e => events.push(e) })
    store.set('granted')
    await vi.advanceTimersByTimeAsync(CONSENT_STORE_TIMEOUT_MS)
    expect(store.snapshot().save).toBe('unsaved')
    expect(events).toEqual(['consent_tracking:store_failed:granted'])
    calls[0].resolve()
    await flush()
    expect(store.snapshot().save).toBe('unsaved')
  })

  it('a denial whose write fails clears an earlier grant, and still says unsaved', async () => {
    const events: string[] = []
    const disk = new Map([[CONSENT_STORAGE_KEY, record('granted')]])
    const store = createConsentStore({
      storage: { ...working(disk), setItem: () => Promise.reject(new Error('full')) },
      report: e => events.push(e),
    })
    store.set('denied')
    await flush()
    expect(store.snapshot().save).toBe('unsaved')
    expect(disk.has(CONSENT_STORAGE_KEY)).toBe(false)
    expect(events).toEqual(['consent_tracking:store_cleared:denied'])
    expect(await createConsentStore({ storage: working(disk) }).load()).toBe('undetermined')
  })

  it('a denial whose write and cleanup both fail reports it; runtime stays denied', async () => {
    const events: string[] = []
    const store = createConsentStore({
      storage: {
        ...working(),
        setItem: () => Promise.reject(new Error('full')),
        removeItem: () => Promise.reject(new Error('full')),
      },
      report: e => events.push(e),
    })
    store.set('denied')
    await flush()
    expect(store.get()).toBe('denied')
    expect(store.snapshot().save).toBe('unsaved')
    expect(events).toEqual(['consent_tracking:store_failed:denied'])
  })

  it('a failed denial landing after a newer grant erases nothing', async () => {
    const events: string[] = []
    const { storage, calls, disk } = controlled()
    const store = createConsentStore({ storage, report: e => events.push(e) })
    store.set('denied')
    store.set('granted')
    calls[1].resolve()
    await flush()
    expect(store.snapshot().save).toBe('saved')
    calls[0].reject()
    await flush()
    expect(calls.map(c => c.op)).toEqual(['set', 'set'])
    expect(JSON.parse(disk.get(CONSENT_STORAGE_KEY)!).status).toBe('granted')
    expect(events).toEqual(['consent_tracking:store_skipped:stale'])
    expect(store.snapshot().save).toBe('saved')
  })

  it('an old write completing after a newer one does not report success for the newer', async () => {
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage })
    store.set('granted')
    store.set('denied')
    calls[0].resolve()
    await flush()
    expect(store.snapshot().save).toBe('saving')
    calls[1].resolve()
    await flush()
    expect(store.snapshot().save).toBe('saved')
  })

  it.each([
    ['on→off→on', ['granted', 'denied', 'granted'], 'granted'],
    ['off→on→off', ['denied', 'granted', 'denied'], 'denied'],
  ] as const)('%s with the middle call stalled: the last answer reads back', async (_label, answers, last) => {
    const disk = new Map<string, string>()
    const { storage, calls } = controlled(disk)
    const store = createConsentStore({ storage })
    for (const answer of answers) store.set(answer)
    calls[0].resolve()
    calls[2].resolve()
    await flush()
    expect(store.get()).toBe(last)
    expect(store.snapshot().save).toBe('saved')
    expect(await createConsentStore({ storage: working(disk) }).load()).toBe(last)
  })

  it('a never-answering head: the denial behind it is still issued, and reported unsaved at its own bound', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage, report: e => events.push(e) })
    store.set('granted')
    await vi.advanceTimersByTimeAsync(1_000)
    store.set('denied')
    expect(calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(CONSENT_STORE_TIMEOUT_MS)
    expect(store.snapshot().save).toBe('unsaved')
    expect(events).toEqual(['consent_tracking:store_failed:denied'])
  })

  it('the accepted limit (D-7): a withdrawal that never reached disk reads the earlier grant next launch', async () => {
    const disk = new Map([[CONSENT_STORAGE_KEY, record('granted')]])
    const { storage } = controlled(disk)
    const dying = createConsentStore({ storage })
    dying.set('denied')
    // The process dies here: nothing was acknowledged, nothing was written.
    expect(await createConsentStore({ storage: working(disk) }).load()).toBe('granted')
  })

  it('retry does nothing while the write is still in its deadline', () => {
    const { storage, calls } = controlled()
    const store = createConsentStore({ storage })
    store.set('denied')
    store.retry()
    expect(calls).toHaveLength(1)
  })

  it('retry after a failure saves, and a stalled first write failing later erases nothing', async () => {
    const disk = new Map<string, string>()
    const { storage, calls } = controlled(disk)
    const store = createConsentStore({ storage })
    vi.useFakeTimers()
    store.set('denied')
    await vi.advanceTimersByTimeAsync(CONSENT_STORE_TIMEOUT_MS)
    expect(store.snapshot().save).toBe('unsaved')
    const generation = store.generation()
    store.retry()
    expect(store.generation()).toBe(generation)
    calls[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.snapshot().save).toBe('saved')
    calls[0].reject()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.map(c => c.op)).toEqual(['set', 'set'])
    expect(JSON.parse(disk.get(CONSENT_STORAGE_KEY)!).status).toBe('denied')
  })
})

describe('observing', () => {
  it('tells its subscribers, with a new snapshot only when something changed', () => {
    const store = createConsentStore({ storage: controlled().storage })
    const before = store.snapshot()
    expect(store.snapshot()).toBe(before)
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.set('granted')
    expect(listener).toHaveBeenCalled()
    expect(store.snapshot()).not.toBe(before)
    listener.mockClear()
    off()
    store.set('denied')
    expect(listener).not.toHaveBeenCalled()
  })
})
