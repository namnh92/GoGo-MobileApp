import { CONSUMED_DEEP_LINK_KEY, PENDING_DEEP_LINK_KEY } from './pending-deep-link'

/** Kept in app-container storage, which an uninstall deletes. Not an id. */
export const INSTALL_MARKER_KEY = 'gogo.install_marker'

export type InstallScopeDeps = {
  /** Secure storage. On iOS the Keychain survives an uninstall. */
  secure: { remove(key: string): Promise<void> }
  /** App storage, wiped with the app. */
  app: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }
  report?: (event: string) => void
}

/**
 * GoGo-MobileApp#364 — the deferred-link state is about one install, and on
 * iOS its secure storage outlives the install. Reinstalled from a new invite,
 * the old pending link would win; reinstalled from the same invite, the old
 * consumed record would refuse it. A fresh app container therefore starts the
 * state over: no marker in app storage means this is a new install, and both
 * keys are dropped before anything collects.
 */
export function createInstallScope(deps: InstallScopeDeps) {
  return async function ensureInstallScope(): Promise<void> {
    if ((await deps.app.get(INSTALL_MARKER_KEY)) !== null) return
    await deps.secure.remove(PENDING_DEEP_LINK_KEY)
    await deps.secure.remove(CONSUMED_DEEP_LINK_KEY)
    await deps.app.set(INSTALL_MARKER_KEY, '1')
    deps.report?.('deferred_link_install_scope_reset')
  }
}
