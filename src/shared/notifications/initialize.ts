/** Bootstrap only: no permission prompt, login, audience selection or send. */
export interface OneSignalBootstrap {
  initialize(appId: string): void
  Debug: { setLogLevel(level: number): void }
  Location: { setShared(shared: boolean): void }
  Notifications: { getPermissionAsync(): Promise<boolean> }
}

export function createOneSignalInitializer(sdk: OneSignalBootstrap, onUnavailable: () => void = () => {}) {
  let initializedApp: string | undefined
  let readiness: Promise<boolean> | undefined
  return (appId: string): Promise<boolean> => {
    if (initializedApp && initializedApp !== appId) throw new Error('OneSignal app cannot change within a running binary')
    if (!appId) throw new Error('OneSignal App ID missing from native build')
    if (readiness) return readiness
    initializedApp = appId
    readiness = Promise.resolve().then(async () => {
      try {
        sdk.Debug.setLogLevel(0)
        sdk.Location.setShared(false)
        sdk.initialize(appId)
        // initialize() returns before its native queue executes. A read on the
        // same RNOneSignal module acknowledges that queue before the separate
        // Expo identity module registers its listener. This never prompts.
        await sdk.Notifications.getPermissionAsync()
        return true
      } catch {
        readiness = undefined
        initializedApp = undefined
        onUnavailable()
        return false
      }
    })
    return readiness
  }
}
