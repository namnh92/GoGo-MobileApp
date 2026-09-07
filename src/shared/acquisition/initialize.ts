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
) {
  let initializedKey: string | undefined
  return (key: string) => {
    if (!key.trim()) throw new Error('Tenjin SDK key is required')
    if (initializedKey === key) return
    if (initializedKey) throw new Error('Tenjin environment cannot change without restarting the app')
    try {
      sdk.initialize(key)
      // Before connect: connect is the call that carries source_app_store.
      sdk.setAppStore(appStore)
      sdk.connect()
      initializedKey = key
    } catch {
      // Acquisition failure must not stop startup or expose provider payloads.
      onUnavailable()
    }
  }
}
