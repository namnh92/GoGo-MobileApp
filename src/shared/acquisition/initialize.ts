interface TenjinSdk {
  initialize(key: string): void
  connect(): void
}

/** Acquisition only: navigation and authenticated identity belong to GoGo. */
export function createTenjinInitializer(sdk: TenjinSdk, onUnavailable: () => void = () => {}) {
  let initializedKey: string | undefined
  return (key: string) => {
    if (!key.trim()) throw new Error('Tenjin SDK key is required')
    if (initializedKey === key) return
    if (initializedKey) throw new Error('Tenjin environment cannot change without restarting the app')
    try {
      sdk.initialize(key)
      sdk.connect()
      initializedKey = key
    } catch {
      // Acquisition failure must not stop startup or expose provider payloads.
      onUnavailable()
    }
  }
}
