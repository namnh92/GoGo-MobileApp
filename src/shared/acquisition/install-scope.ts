import { CONSUMED_DEEP_LINK_KEY, PENDING_DEEP_LINK_KEY, type PendingDeepLinkStorage } from './pending-deep-link'

/** Kept in app-container storage, which an uninstall deletes. Not an id. */
export const INSTALL_MARKER_KEY = 'gogo.install_marker'

export type InstallScopeDeps = {
  /** Secure storage. On iOS the Keychain survives an uninstall. */
  secure: Pick<PendingDeepLinkStorage, 'get' | 'remove'>
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
 *
 * It fails closed. The marker is written only once both entries are verified
 * gone (strict read: "could not look" is not "gone"); anything else rejects and
 * leaves the marker absent, so the next launch tries the reset again and this
 * launch's caller knows not to read or write the state.
 */
export function createInstallScope(deps: InstallScopeDeps) {
  async function erase(key: string): Promise<void> {
    await deps.secure.remove(key)
    if ((await deps.secure.get(key, true)) !== null) {
      throw new Error('deferred link state survived the install reset')
    }
  }

  return async function ensureInstallScope(): Promise<void> {
    if ((await deps.app.get(INSTALL_MARKER_KEY)) !== null) return
    await erase(PENDING_DEEP_LINK_KEY)
    await erase(CONSUMED_DEEP_LINK_KEY)
    await deps.app.set(INSTALL_MARKER_KEY, '1')
    deps.report?.('deferred_link_install_scope_reset')
  }
}
