import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { setOnSessionExpired } from '@/shared/api/client'
import * as roomsApi from '@/shared/api/endpoints/rooms'
import * as sessionsApi from '@/shared/api/endpoints/sessions'
import { unsubscribeCurrentDeviceAndConfirm } from '@/shared/notifications/logout-confirmation-bootstrap'
import { purgeCachedUserData } from '@/shared/api/query-client'
import {
  getSession,
  hydrateSession,
  subscribeToSession,
  type Session,
} from '@/shared/api/session'
import type { OpBody } from '@/shared/api/types'
import { clearRecentRooms } from '@/shared/store/recentRoomsStore'

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

  /** Server cache, persisted cache and the local room list, in one place. */
  const purge = useCallback(async () => {
    clearRecentRooms()
    await purgeCachedUserData(queryClient)
  }, [queryClient])

  // A dead session must not leave another member's room data on the device.
  useEffect(() => {
    setOnSessionExpired(() => {
      void purge()
    })
    return () => setOnSessionExpired(null)
  }, [purge])

  const signIn = useCallback(
    async (body: OpBody<'login'>) => {
      await purge()
      return sessionsApi.login(body)
    },
    [purge],
  )

  const signUp = useCallback(
    async (body: OpBody<'register'>) => {
      await purge()
      return sessionsApi.register(body)
    },
    [purge],
  )

  const joinAsGuest = useCallback(
    async (body: OpBody<'joinRoomAsGuest'>) => {
      await purge()
      return roomsApi.joinRoomAsGuest(body)
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
      await unsubscribeCurrentDeviceAndConfirm()
      await sessionsApi.logout(allDevices)
      await purge()
    },
    [purge],
  )

  const deleteAccount = useCallback(async () => {
    await sessionsApi.deleteAccount()
    await purge()
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
