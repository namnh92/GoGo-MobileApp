/**
 * GoGo-MobileApp#398 (shape D5, D6, R-16) — the promotions switch of a device
 * with no account, and the record of what the person answered to the disclosure.
 * History is prepared before mutations. Writes share one tail; a UI timeout
 * reports failure without letting a later write overtake the unfinished one.
 *
 * A read that fails or stalls is not the same as nothing stored. "Nothing stored"
 * retires the device's identity (R-17); a slow disk must not, so `load()` reports
 * `unreadable` and the coordinator leaves everything as it is.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'

export const DEVICE_PROMOTIONS_STORAGE_KEY = 'gogo.push.device-promotions.v1'

/** The words the person answered. New wording bumps this, and they are asked again. */
export const DEVICE_PROMOTIONS_DISCLOSURE = 'device-promotions-v1'

export const DEVICE_PROMOTIONS_STORE_TIMEOUT_MS = 2_000

export type DisclosureAnswer = 'accepted' | 'declined'

const recordSchema = z.object({
  envelopeVersion: z.literal(1).default(1),
  disclosure: z.object({
    id: z.string(),
    answer: z.enum(['accepted', 'declined']),
    at: z.string(),
  }).nullable(),
  enabled: z.boolean(),
  version: z.number().int().min(0),
  pendingVersion: z.number().int().min(0).nullable(),
  awaitingProviderOff: z.boolean(),
  /** Older records have no field: no debt was ever recorded for them. */
  retirementOwed: z.boolean().default(false),
})

type StoredRecord = z.infer<typeof recordSchema>

export type DevicePromotionsSnapshot = {
  /** `absent`: nothing current is stored. `unreadable`: could not tell. */
  read: 'loading' | 'loaded' | 'absent' | 'unreadable'
  answer: DisclosureAnswer | null
  enabled: boolean
  version: number
  pendingVersion: number | null
  /** An OFF the provider has not been seen to honour yet (R-16). */
  awaitingProviderOff: boolean
  /** Retirement intent outlives both the answer and a failed quarantine (R-17). */
  retirementOwed: boolean
  save: 'idle' | 'saving' | 'saved' | 'unsaved'
  /** The server answered DISABLED this launch. Not stored: the next launch asks again. */
  serviceOff: boolean
}

export interface DevicePromotionsStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

const INITIAL: DevicePromotionsSnapshot = {
  read: 'loading',
  answer: null,
  // Owner Q5: on once the person has said "Tiếp tục". Nothing happens before that.
  enabled: true,
  version: 0,
  pendingVersion: null,
  awaitingProviderOff: false,
  retirementOwed: false,
  save: 'idle',
  serviceOff: false,
}

export function createDevicePromotionsStore(deps: {
  storage: DevicePromotionsStorage
  report?: (event: string) => void
  now?: () => Date
  timeoutMs?: number
}) {
  const report = deps.report ?? (() => {})
  const now = deps.now ?? (() => new Date())
  const timeoutMs = deps.timeoutMs ?? DEVICE_PROMOTIONS_STORE_TIMEOUT_MS

  let snapshot = INITIAL
  let answeredAt: string | null = null
  let mutation = 0
  let debtVersion = 0
  let prepared = false
  let historyRead = false
  let loading: Promise<DevicePromotionsSnapshot> | undefined
  let tail: Promise<boolean> = Promise.resolve(true)
  const listeners = new Set<() => void>()

  function update(next: Partial<DevicePromotionsSnapshot>) {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }

  function bounded<T>(work: Promise<T>, fallback: T): Promise<T> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(fallback), timeoutMs)
      work.then(value => {
        clearTimeout(timer)
        resolve(value)
      }, () => {
        clearTimeout(timer)
        resolve(fallback)
      })
    })
  }

  function persist(next: Partial<DevicePromotionsSnapshot>, clearDebt = false): Promise<boolean> {
    const issued = ++mutation
    const clearingVersion = debtVersion
    update({ ...next, save: 'saving', ...(prepared ? { read: (next.answer ?? snapshot.answer) ? 'loaded' : 'absent' } : {}) })
    const write = tail.then(async () => {
      // Merge at the persistence owner, after the preceding write has settled.
      const clearing = clearDebt && clearingVersion === debtVersion
      const record: StoredRecord = {
        envelopeVersion: 1,
        disclosure: snapshot.answer && answeredAt
          ? { id: DEVICE_PROMOTIONS_DISCLOSURE, answer: snapshot.answer, at: answeredAt }
          : null,
        enabled: snapshot.enabled,
        version: snapshot.version,
        pendingVersion: snapshot.pendingVersion,
        awaitingProviderOff: snapshot.awaitingProviderOff,
        retirementOwed: clearing ? false : snapshot.retirementOwed,
      }
      await deps.storage.setItem(DEVICE_PROMOTIONS_STORAGE_KEY, JSON.stringify(record))
      if (clearing && clearingVersion === debtVersion) update({ retirementOwed: false })
      return true
    }).catch(() => false)
    tail = write
    return bounded(write, false).then(saved => {
      if (issued === mutation) {
        if (!saved) report('push_device_store_failed')
        update({ save: saved ? 'saved' : 'unsaved' })
      }
      return saved
    })
  }

  function load(): Promise<DevicePromotionsSnapshot> {
    if (prepared) return Promise.resolve(snapshot)
    loading ??= (async () => {
      if (!historyRead) {
        const raw = await bounded(Promise.resolve().then(() => deps.storage.getItem(DEVICE_PROMOTIONS_STORAGE_KEY)), undefined)
        if (raw === undefined) {
          update({ read: 'unreadable', save: 'unsaved' })
          return snapshot
        }
        let parsed: StoredRecord | null = null
        try {
          const result = recordSchema.safeParse(raw === null ? null : JSON.parse(raw))
          parsed = result.success ? result.data : null
        } catch { /* Invalid history is missing history, not a refused read. */ }
        const disclosure = parsed?.disclosure?.id === DEVICE_PROMOTIONS_DISCLOSURE ? parsed.disclosure : null
        answeredAt = disclosure?.at ?? null
        update({
          answer: disclosure?.answer ?? null,
          enabled: parsed?.enabled ?? true,
          version: parsed?.version ?? 0,
          pendingVersion: parsed?.pendingVersion ?? null,
          awaitingProviderOff: parsed?.awaitingProviderOff ?? false,
          retirementOwed: Boolean(parsed?.retirementOwed || !disclosure || disclosure.answer === 'declined'),
        })
        historyRead = true
      }
      // Migration and lost-history intent are durable before the sheet is ready.
      if (await persist({})) {
        prepared = true
        update({ read: snapshot.answer ? 'loaded' : 'absent' })
      } else update({ read: 'unreadable' })
      return snapshot
    })().finally(() => { loading = undefined })
    return loading
  }

  function mutate(change: () => Promise<boolean>): Promise<boolean> {
    if (prepared) return change()
    return load().then(() => prepared ? change() : false)
  }

  return {
    load,
    async saved(): Promise<boolean> {
      await load()
      return prepared && await bounded(tail, false)
    },

    /** The person answered the sheet, or turned the switch on in Settings. */
    answer(answer: DisclosureAnswer): Promise<boolean> {
      return mutate(() => {
        answeredAt = now().toISOString()
        if (answer === 'declined') debtVersion += 1
        const enabled = answer === 'accepted'
        const version = snapshot.version + 1
        return persist({
          answer,
          enabled,
          version,
          pendingVersion: version,
          // A decline leaves no identity to report on; R-17 retires what survives.
          awaitingProviderOff: false,
          retirementOwed: snapshot.retirementOwed || answer === 'declined',
        })
      })
    },

    /** A change of the switch: a new version, unacknowledged until the server says so. */
    setEnabled(enabled: boolean): Promise<boolean> {
      return mutate(() => {
        const version = snapshot.version + 1
        return persist({ enabled, version, pendingVersion: version, awaitingProviderOff: !enabled })
      })
    },

    /**
     * What a report came back with. A response for an older version clears neither
     * a newer choice nor its convergence (R-16); persistence alone never ends an OFF,
     * only `providerEnabled: false` for the current version does.
     */
    acknowledge(result: { appliedVersion: number; providerEnabled: boolean }): Promise<boolean> {
      return mutate(() => {
        if (result.appliedVersion !== snapshot.version) return Promise.resolve(true)
        const pendingVersion = snapshot.pendingVersion === result.appliedVersion ? null : snapshot.pendingVersion
        const awaitingProviderOff = snapshot.awaitingProviderOff && result.providerEnabled
        if (pendingVersion === snapshot.pendingVersion && awaitingProviderOff === snapshot.awaitingProviderOff) return Promise.resolve(true)
        return persist({ pendingVersion, awaitingProviderOff })
      })
    },

    /** A login restored delivery: this OFF is not settled until the provider shows it again. */
    expectProviderOff(): void {
      void mutate(() => !snapshot.enabled && !snapshot.awaitingProviderOff ? persist({ awaitingProviderOff: true }) : Promise.resolve(true))
    },

    /** 409 PUSH_PREFERENCE_STALE: the server holds a newer version; go past it. */
    adoptStoredVersion(storedVersion: number): void {
      void mutate(() => {
        const version = storedVersion + 1
        return persist({ version, pendingVersion: version })
      })
    },

    /** Settings' retry: a fresh write of what is held now. */
    retrySave(): void {
      if (!prepared) void load()
      else if (snapshot.save === 'unsaved') void persist({})
    },

    setServiceOff(serviceOff: boolean): void {
      if (snapshot.serviceOff !== serviceOff) update({ serviceOff })
    },

    /** Clearance stays owed in memory until its write succeeds. */
    setRetirementOwed(retirementOwed: boolean): Promise<boolean> {
      return mutate(() => {
        if (retirementOwed) {
          debtVersion += 1
          return persist({ retirementOwed: true })
        }
        return persist({}, true)
      })
    },

    snapshot: (): DevicePromotionsSnapshot => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type DevicePromotionsStore = ReturnType<typeof createDevicePromotionsStore>

/** The app's one instance. */
export const devicePromotionsStore = createDevicePromotionsStore({
  storage: AsyncStorage,
  report: event => console.warn(event),
})
