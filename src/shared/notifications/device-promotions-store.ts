/**
 * GoGo-MobileApp#398 (shape D5, D6, R-16) — the promotions switch of a device
 * with no account, and the record of what the person answered to the disclosure.
 * Same rules as `consent-store.ts`: runtime first, the write issued in the same
 * tick, every call bounded, nothing throws.
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
  disclosure: z.object({
    id: z.literal(DEVICE_PROMOTIONS_DISCLOSURE),
    answer: z.enum(['accepted', 'declined']),
    at: z.string(),
  }),
  enabled: z.boolean(),
  version: z.number().int().min(0),
  pendingVersion: z.number().int().min(0).nullable(),
  awaitingProviderOff: z.boolean(),
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
  let loading: Promise<void> | undefined
  const listeners = new Set<() => void>()

  function update(next: Partial<DevicePromotionsSnapshot>) {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }

  function persist(next: Partial<DevicePromotionsSnapshot>) {
    const issued = ++mutation
    const merged = { ...snapshot, ...next, read: 'loaded' as const, save: 'saving' as const }
    const record: StoredRecord | null =
      merged.answer && answeredAt
        ? {
            disclosure: { id: DEVICE_PROMOTIONS_DISCLOSURE, answer: merged.answer, at: answeredAt },
            enabled: merged.enabled,
            version: merged.version,
            pendingVersion: merged.pendingVersion,
            awaitingProviderOff: merged.awaitingProviderOff,
          }
        : null
    let finished = false
    const finish = (state: 'saved' | 'unsaved') => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (issued !== mutation) return
      if (state === 'unsaved') report('push_device_store_failed')
      update({ save: state })
    }
    const timer = setTimeout(() => finish('unsaved'), timeoutMs)
    let write: Promise<void>
    try {
      write = record
        ? deps.storage.setItem(DEVICE_PROMOTIONS_STORAGE_KEY, JSON.stringify(record))
        : Promise.resolve()
    } catch (error) {
      write = Promise.reject(error)
    }
    write.then(
      () => finish('saved'),
      () => finish('unsaved'),
    )
    update(merged)
  }

  return {
    /** Reads once per process. Never rejects. */
    load(): Promise<DevicePromotionsSnapshot> {
      loading ??= new Promise<void>(resolve => {
        const finish = (next: Partial<DevicePromotionsSnapshot>) => {
          clearTimeout(timer)
          // Anything decided while this was reading is newer than the disk.
          if (snapshot.read === 'loading') update(next)
          resolve()
        }
        const timer = setTimeout(() => finish({ read: 'unreadable' }), timeoutMs)
        let reading: Promise<string | null>
        try {
          reading = deps.storage.getItem(DEVICE_PROMOTIONS_STORAGE_KEY)
        } catch (error) {
          reading = Promise.reject(error)
        }
        reading.then(
          raw => {
            if (raw === null) {
              finish({ read: 'absent' })
              return
            }
            let parsed: StoredRecord | null = null
            try {
              const result = recordSchema.safeParse(JSON.parse(raw))
              parsed = result.success ? result.data : null
            } catch {
              parsed = null
            }
            if (!parsed) {
              // Older wording, or a record nothing can read: not an answer.
              finish({ read: 'absent' })
              return
            }
            answeredAt = parsed.disclosure.at
            finish({
              read: 'loaded',
              answer: parsed.disclosure.answer,
              enabled: parsed.enabled,
              version: parsed.version,
              pendingVersion: parsed.pendingVersion,
              awaitingProviderOff: parsed.awaitingProviderOff,
            })
          },
          () => finish({ read: 'unreadable' }),
        )
      })
      return loading.then(() => snapshot)
    },

    /** The person answered the sheet, or turned the switch on in Settings. */
    answer(answer: DisclosureAnswer): void {
      answeredAt = now().toISOString()
      const enabled = answer === 'accepted'
      const version = snapshot.version + 1
      persist({
        answer,
        enabled,
        version,
        pendingVersion: version,
        // A decline leaves no identity to report on; R-17 retires what survives.
        awaitingProviderOff: false,
      })
    },

    /** A change of the switch: a new version, unacknowledged until the server says so. */
    setEnabled(enabled: boolean): void {
      const version = snapshot.version + 1
      persist({ enabled, version, pendingVersion: version, awaitingProviderOff: !enabled })
    },

    /**
     * What a report came back with. A response for an older version clears neither
     * a newer choice nor its convergence (R-16); persistence alone never ends an OFF,
     * only `providerEnabled: false` for the current version does.
     */
    acknowledge(result: { appliedVersion: number; providerEnabled: boolean }): void {
      if (result.appliedVersion !== snapshot.version) return
      const pendingVersion = snapshot.pendingVersion === result.appliedVersion ? null : snapshot.pendingVersion
      const awaitingProviderOff = snapshot.awaitingProviderOff && result.providerEnabled
      if (pendingVersion === snapshot.pendingVersion && awaitingProviderOff === snapshot.awaitingProviderOff) return
      persist({ pendingVersion, awaitingProviderOff })
    },

    /** A login restored delivery: this OFF is not settled until the provider shows it again. */
    expectProviderOff(): void {
      if (!snapshot.enabled && !snapshot.awaitingProviderOff) persist({ awaitingProviderOff: true })
    },

    /** 409 PUSH_PREFERENCE_STALE: the server holds a newer version; go past it. */
    adoptStoredVersion(storedVersion: number): void {
      const version = storedVersion + 1
      persist({ version, pendingVersion: version })
    },

    /** Settings' retry: a fresh write of what is held now. */
    retrySave(): void {
      if (snapshot.save === 'unsaved') persist({})
    },

    setServiceOff(serviceOff: boolean): void {
      if (snapshot.serviceOff !== serviceOff) update({ serviceOff })
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
