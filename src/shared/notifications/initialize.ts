/** Bootstrap only: no permission prompt, login, audience selection or send. */
export interface OneSignalBootstrap {
  initialize(appId: string): void
  Debug: { setLogLevel(level: number): void }
  Location: { setShared(shared: boolean): void }
}

export function createOneSignalInitializer(sdk: OneSignalBootstrap, onUnavailable: () => void = () => {}) {
  let initializedApp: string | undefined
  return (appId: string) => {
    if (initializedApp === appId) return
    if (initializedApp) throw new Error('OneSignal app cannot change within a running binary')
    if (!appId) throw new Error('OneSignal App ID missing from native build')
    try {
      // SDK verbose logs can contain subscription identifiers. Do not enable
      // them automatically in DEV; DEV follows the production privacy contract.
      sdk.Debug.setLogLevel(0)
      sdk.Location.setShared(false)
      sdk.initialize(appId)
      initializedApp = appId
    } catch {
      // A provider that fails to start must not take the app down with it —
      // the same isolation the acquisition SDK gets. Nothing is recorded as
      // initialized, so a later mount may try again.
      onUnavailable()
    }
  }
}
