/**
 * GoGo-MobileApp#370 (MMP-APP-004, ADR 0013) — the Android answer to GoGo's own
 * tracking question, and the one value the gate, the Settings switch and the
 * acquisition bootstrap read.
 *
 * Android has no system dialog, so this is the record. Rules:
 *
 *   - **runtime first.** `set()` changes the value at once and issues the write
 *     in the same tick. Persistence never holds a decision: a withdrawal stops
 *     the SDKs whatever the disk does;
 *   - **every call is bounded and nothing throws.** A read that fails, stalls or
 *     holds anything but a current record is `undetermined`: asked again;
 *   - **issue order, no JS queue.** AsyncStorage runs its calls on one serial
 *     executor in the order they were issued, so JS never waits for an earlier
 *     call and a stalled one cannot block a later one from being issued. That is
 *     not a durability guarantee: a stalled executor still blocks the disk;
 *   - **a stale mutation does nothing.** Cleanup after a failed denial is
 *     dropped when anything newer was issued, so it can never erase a newer
 *     grant;
 *   - **`saved` means saved.** Only a call that resolved inside its deadline
 *     and is still the newest. Anything else is `unsaved`, and Settings says so;
 *   - **one local record.** One answer with the wording it answered, no history,
 *     gone with the app (`allowBackup: false`). Known limit: a process killed
 *     between a withdrawal and its write reaching disk reads the earlier grant
 *     next launch (`docs/store-privacy.md` §12 D-7).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'

export const CONSENT_STORAGE_KEY = 'gogo.consent.tracking.v1'

/** The words the person answered. New wording bumps this, and they are asked again. */
export const CONSENT_DISCLOSURE = 'android-consent-v1'

/** A local read or write this slow is broken, not busy. */
export const CONSENT_STORE_TIMEOUT_MS = 2_000

export type ConsentAnswer = 'granted' | 'denied'
export type ConsentValue = ConsentAnswer | 'undetermined'
export type ConsentSaveState = 'idle' | 'saving' | 'saved' | 'unsaved'

export type ConsentSnapshot = {
  value: ConsentValue
  /** The stored answer has been read, or an answer made since. */
  loaded: boolean
  save: ConsentSaveState
}

export interface ConsentStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const recordSchema = z.object({
  status: z.enum(['granted', 'denied']),
  at: z.string(),
  disclosure: z.literal(CONSENT_DISCLOSURE),
})

function parseRecord(raw: string | null): ConsentValue {
  if (raw === null) return 'undetermined'
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.status : 'undetermined'
  } catch {
    return 'undetermined'
  }
}

/** Issues the call now; a synchronous throw is a rejection. */
function issue<T>(call: () => Promise<T>): Promise<T> {
  try {
    return call()
  } catch (error) {
    return Promise.reject(error)
  }
}

export function createConsentStore(deps: {
  storage: ConsentStorage
  report?: (event: string) => void
  now?: () => Date
  timeoutMs?: number
}) {
  const report = deps.report ?? (() => {})
  const now = deps.now ?? (() => new Date())
  const timeoutMs = deps.timeoutMs ?? CONSENT_STORE_TIMEOUT_MS

  let snapshot: ConsentSnapshot = { value: 'undetermined', loaded: false, save: 'idle' }
  /** Bumped by every change of mind: what an SDK start was authorised under. */
  let generation = 0
  /** Bumped by every mutation, retries included: what makes one stale. */
  let mutation = 0
  let loading: Promise<void> | undefined
  const listeners = new Set<() => void>()

  function update(next: Partial<ConsentSnapshot>) {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }

  /** A failed denial must not leave an earlier grant to be read next launch. */
  function clearAfterFailedDenial(issued: number) {
    if (issued !== mutation) {
      report('consent_tracking:store_skipped:stale')
      return
    }
    let finished = false
    const finish = (event: string) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (issued === mutation) report(event)
    }
    const timer = setTimeout(() => finish('consent_tracking:store_failed:denied'), timeoutMs)
    issue(() => deps.storage.removeItem(CONSENT_STORAGE_KEY)).then(
      () => finish('consent_tracking:store_cleared:denied'),
      () => finish('consent_tracking:store_failed:denied'),
    )
  }

  function write(answer: ConsentAnswer) {
    const issued = ++mutation
    update({ save: 'saving' })
    let reported = false
    const fail = () => {
      if (reported || issued !== mutation) return
      reported = true
      update({ save: 'unsaved' })
      if (answer === 'granted') report('consent_tracking:store_failed:granted')
    }
    const timer = setTimeout(() => {
      fail()
      if (answer === 'denied' && issued === mutation) report('consent_tracking:store_failed:denied')
    }, timeoutMs)
    const record = JSON.stringify({ status: answer, at: now().toISOString(), disclosure: CONSENT_DISCLOSURE })
    issue(() => deps.storage.setItem(CONSENT_STORAGE_KEY, record)).then(
      () => {
        clearTimeout(timer)
        // Late is not saved: a slow call already told Settings it was not.
        if (!reported && issued === mutation) update({ save: 'saved' })
      },
      () => {
        clearTimeout(timer)
        fail()
        if (answer === 'denied') clearAfterFailedDenial(issued)
      },
    )
  }

  return {
    /** Reads the stored answer once per process; resolves to the current value, never rejects. */
    load(): Promise<ConsentValue> {
      loading ??= new Promise<void>(resolve => {
        const finish = (read: ConsentValue) => {
          clearTimeout(timer)
          // An answer made while this was reading is newer than anything on disk.
          if (generation === 0 && !snapshot.loaded) update({ value: read, loaded: true })
          resolve()
        }
        const timer = setTimeout(() => finish('undetermined'), timeoutMs)
        issue(() => deps.storage.getItem(CONSENT_STORAGE_KEY)).then(
          raw => finish(parseRecord(raw)),
          () => finish('undetermined'),
        )
      })
      return loading.then(() => snapshot.value)
    },

    /** The person decided. Runtime now, write issued in this same tick. */
    set(answer: ConsentAnswer): void {
      generation += 1
      update({ value: answer, loaded: true })
      write(answer)
    },

    /** Settings' "thử lại": a fresh write of the current answer. */
    retry(): void {
      if (snapshot.save === 'unsaved' && snapshot.value !== 'undetermined') write(snapshot.value)
    },

    get: (): ConsentValue => snapshot.value,
    generation: (): number => generation,
    snapshot: (): ConsentSnapshot => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type ConsentStore = ReturnType<typeof createConsentStore>

/** The app's one instance. */
export const consentStore = createConsentStore({
  storage: AsyncStorage,
  // Reason codes only, so release builds keep them: device acceptance reads them.
  report: event => console.warn(event),
})
