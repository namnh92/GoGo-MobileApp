import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { setOnSessionExpired } from '@/shared/api/client'
import * as roomsApi from '@/shared/api/endpoints/rooms'
import * as sessionsApi from '@/shared/api/endpoints/sessions'
import { pendingDeepLinks } from '@/shared/acquisition/pending-deep-links'
import { useDiscoveryAreaStore } from '@/features/search/discovery-area-store'
import { pushIdentity } from '@/shared/notifications/identity-bootstrap'
import { purgeCachedUserData } from '@/shared/api/query-client'
import {
  captureSessionScope,
  beginSessionEnd,
  SessionCancelledError,
  getSession,
  hydrateSession,
  subscribeToSession,
  type Session,
} from '@/shared/api/session'
import type { OpBody } from '@/shared/api/types'
import { clearSavedRoomDraft, loadRoomDraft } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { clearRecentRooms } from '@/shared/store/recentRoomsStore'
import { forgetAssistantIntro } from '@/shared/store/assistantIntroStore'
import { purgeInviteCodes } from '@/shared/storage/invite-codes'

export type SessionStatus = 'hydrating' | 'anonymous' | 'user' | 'guest'

interface SessionContextValue {
  session: Session | null
  status: SessionStatus
  /** Room a guest session is scoped to — guests can reach no other room. */
  guestRoomId: string | null
  signIn: (body: OpBody<'login'>) => Promise<Session>
  signUp: (body: OpBody<'register'>) => Promise<Session>
  joinAsGuest: (body: OpBody<'joinRoomAsGuest'>) => Promise<Session>
  signOut: (allDevices?: boolean) => Promise<void>
  /** Irreversible: PII is nulled and every session revoked server-side. */
  deleteAccount: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(() => getSession())
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToSession(setSession)
    void hydrateSession().finally(() => setHydrating(false))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!hydrating) void loadRoomDraft(session?.kind === 'user' ? session.userId ?? null : null)
  }, [hydrating, session?.kind, session?.userId])

  /** Account caches, discovery selection, room drafts and invite codes, in one place. */
  const purge = useCallback(async (preserveAnonymousDraft = false, scope = captureSessionScope()) => {
    scope.assert()
    clearRecentRooms()
    useDiscoveryAreaStore.getState().setArea(null)
    // A host's invite codes belong to that account (#199); the next person on
    // this device must not inherit them.
    await scope.wait(purgeInviteCodes(scope))
    scope.assert()
    if (!preserveAnonymousDraft) {
      useRoomStore.getState().resetDraft()
      useRoomStore.setState({ preferenceSeed: null })
    }
    await scope.wait(clearSavedRoomDraft(scope))
    scope.assert()
    await scope.wait(purgeCachedUserData(queryClient, scope))
  }, [queryClient])

  // A dead session must not leave another member's room data on the device.
  useEffect(() => {
    setOnSessionExpired((scope = captureSessionScope()) => {
      void purge(false, scope).catch(error => {
        if (!(error instanceof SessionCancelledError)) console.warn('session_cleanup_failed')
      })
    })
    return () => setOnSessionExpired(null)
  }, [purge])

  const signIn = useCallback(
    async (body: OpBody<'login'>) => {
      const scope = captureSessionScope()
      await purge(!getSession(), scope)
      scope.assert()
      return sessionsApi.login(body, scope)
    },
    [purge],
  )

  const signUp = useCallback(
    async (body: OpBody<'register'>) => {
      const scope = captureSessionScope()
      await purge(!getSession(), scope)
      scope.assert()
      return sessionsApi.register(body, scope)
    },
    [purge],
  )

  const joinAsGuest = useCallback(
    async (body: OpBody<'joinRoomAsGuest'>) => {
      const scope = captureSessionScope()
      return roomsApi.joinRoomAsGuest(body, () => purge(false, scope))
    },
    [purge],
  )

  const signOut = useCallback(
    async (allDevices = false) => {
      // NTF-APP-004 (#160). Order is the whole point:
      //
      //   1. unsubscribe this device and have the provider confirm it,
      //   2. revoke the session server-side,
      //   3. only then clear anything locally.
      //
      // Step 1 needs the session to make its authenticated check, so it cannot
      // move after step 3 — which is where it effectively sat before, because
      // clearing credentials is what used to trigger the SDK logout. Any step
      // throwing leaves the user signed in and the caller reporting failure.
      // A guest is never bound to the provider, so it has nothing to confirm
      // (#279) — see `createLogoutConfirmation`.
      //
      // #398: the coordinator owns step 1 (R-21). If anything up to the server's
      // answer fails the person stays signed in, so the device has to be theirs
      // again: `cancelSignOut` binds it back.
      const scope = beginSessionEnd()
      try {
        await scope.wait(pushIdentity.beginSignOut(getSession()?.kind === 'guest' ? 'guest' : 'user', scope))
        scope.assert()
        // #364: before the session ends, and not in `purge`, which sign-in also
        // runs — the invite someone installed from must survive their own
        // sign-in, not another person's. Throws if the entry is not gone.
        await scope.wait(pendingDeepLinks.clear(scope))
        scope.assert()
        await sessionsApi.logout(allDevices, scope)
      } catch (error) {
        if (!scope.signal.aborted) void pushIdentity.cancelSignOut()
        throw error
      }
      const cleanup = captureSessionScope(scope.generation + 1)
      await purge(false, cleanup)
    },
    [purge],
  )

  const deleteAccount = useCallback(async () => {
    const scope = beginSessionEnd()
    await scope.wait(pendingDeepLinks.clear(scope))
    scope.assert()
    const deleted = getSession()?.userId
    await sessionsApi.deleteAccount(scope)
    const cleanup = captureSessionScope(scope.generation + 1)
    // The GoGo AI intro flags (#379) outlive sign-out, not the account.
    if (deleted) forgetAssistantIntro(deleted)
    await purge(false, cleanup)
  }, [purge])

  const value = useMemo<SessionContextValue>(() => {
    const status: SessionStatus = hydrating
      ? 'hydrating'
      : session
        ? session.kind
        : 'anonymous'
    return {
      session,
      status,
      guestRoomId: session?.kind === 'guest' ? (session.roomId ?? null) : null,
      signIn,
      signUp,
      joinAsGuest,
      signOut,
      deleteAccount,
    }
  }, [hydrating, session, signIn, signUp, joinAsGuest, signOut, deleteAccount])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside <SessionProvider>')
  return context
}

/** True once credentials are loaded and an actor exists (user or guest). */
export function useIsAuthenticated(): boolean {
  const { status } = useSession()
  return status === 'user' || status === 'guest'
}
