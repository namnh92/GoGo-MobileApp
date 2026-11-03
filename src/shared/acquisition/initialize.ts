interface TenjinSdk {
  initialize(key: string): void
  connect(): void
  setAppStore(type: 'googleplay' | 'amazon' | 'other'): void
}

/**
 * Which store this build is distributed through. Tenjin reads it from the
 * manifest otherwise, and on the DEV device run that failed —
 *
 *   SourceAppStoreGetter: Unable to load app store type from manifest:
 *   No enum constant com.tenjin.android.TenjinSDK.AppStoreType.
 *
 * — leaving `source_app_store=unspecified` on every connect. It is set
 * explicitly here because the value decides which install-referrer API Tenjin
 * reads, and a wrong or absent one attributes store installs to nothing.
 */
export type AppStore = 'googleplay' | 'amazon' | 'other'

/** Acquisition only: navigation and authenticated identity belong to GoGo. */
export function createTenjinInitializer(
  sdk: TenjinSdk,
  onUnavailable: () => void = () => {},
  appStore: AppStore = 'googleplay',
  /**
   * #404 (Android): what this launch may send is decided after the store is
   * known and before connect, the call that sends it. A throw is a failed start:
   * no connect, rather than one that may carry an identifier it should not.
   */
  beforeConnect: () => void = () => {},
) {
  let initializedKey: string | undefined
  /** Whether Tenjin is connected for this key: a failed start is retried by the next call. */
  return (key: string): boolean => {
    if (!key.trim()) throw new Error('Tenjin SDK key is required')
    if (initializedKey === key) return true
    if (initializedKey) throw new Error('Tenjin environment cannot change without restarting the app')
    try {
      sdk.initialize(key)
      // Before connect: connect is the call that carries source_app_store.
      sdk.setAppStore(appStore)
      beforeConnect()
      sdk.connect()
      initializedKey = key
      return true
    } catch {
      // Acquisition failure must not stop startup or expose provider payloads.
      onUnavailable()
      return false
    }
  }
}
