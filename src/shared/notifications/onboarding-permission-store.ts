import AsyncStorage from '@react-native-async-storage/async-storage'

export const ONBOARDING_PERMISSION_KEY = 'gogo.onboarding.push-intent.v1'

/**
 * Device-local intent only; it contains neither an identity nor a consent answer.
 * Persistence is best effort: a failed pending write can lose intent on restart;
 * a failed consumed write can replay it. Launch-memory single-flight still holds.
 */
export function createOnboardingPermissionStore(storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>) {
  let pending = false
  let loaded = false
  let revision = 0
  let claimed: number | undefined
  let loading: Promise<void> | undefined
  let writes = Promise.resolve()
  const listeners = new Set<() => void>()
  const publish = () => { for (const listener of listeners) listener() }
  function persist(value: boolean) {
    writes = writes.then(() => storage.setItem(ONBOARDING_PERMISSION_KEY, value ? 'pending' : 'consumed')).catch(() => {})
    return writes
  }
  return {
    load(): Promise<void> {
      if (loaded) return Promise.resolve()
      const readingRevision = revision
      loading ??= storage.getItem(ONBOARDING_PERMISSION_KEY).then(value => {
        if (revision === readingRevision) pending = value === 'pending'
      }).catch(() => {}).then(() => { loaded = true; publish() })
      return loading
    },
    defer(): Promise<void> {
      revision += 1
      loaded = true
      pending = true
      publish()
      return persist(true)
    },
    claim(): number | undefined {
      if (!pending || claimed !== undefined) return undefined
      claimed = revision
      return claimed
    },
    async consume(token: number): Promise<void> {
      if (claimed !== token) return
      if (revision === token) {
        pending = false
        publish()
        await persist(false)
      }
      claimed = undefined
      publish()
    },
    snapshot: () => pending,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}

export type OnboardingPermissionStore = ReturnType<typeof createOnboardingPermissionStore>
export const onboardingPermissionStore = createOnboardingPermissionStore(AsyncStorage)
