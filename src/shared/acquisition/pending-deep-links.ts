import { deleteSecureItem, getSecureItem, setSecureItem } from '@/shared/storage/secure-store'

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
