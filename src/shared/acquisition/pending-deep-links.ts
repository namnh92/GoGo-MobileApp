import AsyncStorage from '@react-native-async-storage/async-storage'

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/shared/storage/secure-store'

import { createInstallScope } from './install-scope'
import { createPendingDeepLinkStore } from './pending-deep-link'

/**
 * A deferred link is not a preference — a ROOM_INVITE slug *is* the invite
 * code — so it lives in secure storage, the same place the session does.
 *
 * Its own module, apart from `bootstrap.ts`, so the session provider can clear
 * it at sign-out without importing the attribution SDK's native module.
 */
export const pendingDeepLinks = createPendingDeepLinkStore({
  storage: {
    get: getSecureItem,
    set: setSecureItem,
    remove: deleteSecureItem,
  },
  report: (event) => console.warn(event),
})

/** Run before anything collects; see `install-scope.ts`. */
export const ensureInstallScope = createInstallScope({
  secure: { remove: deleteSecureItem },
  app: { get: (key) => AsyncStorage.getItem(key), set: (key, value) => AsyncStorage.setItem(key, value) },
  report: (event) => console.warn(event),
})
