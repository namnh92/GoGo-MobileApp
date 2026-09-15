import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useEffect, useState, type ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import {
  bindAppStateToQueryClient,
  createQueryClient,
  queryPersister,
  shouldPersistQuery,
} from '@/shared/api/query-client'

import { SessionProvider } from './session-provider'
import { initializeAcquisitionSdk } from '@/shared/acquisition/bootstrap'
import { initializePushSdk } from '@/shared/notifications/bootstrap'
import { initializePushIdentity } from '@/shared/notifications/identity-bootstrap'
import { retryInitialization } from '@/shared/notifications/initialize'
import { startNotificationClicks } from '@/shared/notifications/notification-clicks-bootstrap'

/** Bumping this discards every persisted cache — use it when a DTO shape changes. */
const CACHE_BUSTER = 'gogo.v1.0.0-alpha.2'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  useEffect(() => bindAppStateToQueryClient(), [])
  useEffect(() => initializeAcquisitionSdk(), [])
  useEffect(() => {
    let cancelled = false
    let stopClicks: (() => void) | undefined
    let stopIdentity: (() => void) | undefined
    void retryInitialization(initializePushSdk).then(result => {
      if (result !== 'ready' || cancelled) return
      // #256 — first, so the tap that launched the app is routed without
      // waiting on identity; `NotificationClickRouter` holds it until ready.
      stopClicks = startNotificationClicks()
      stopIdentity = initializePushIdentity()
    })
    return () => {
      cancelled = true
      stopClicks?.()
      stopIdentity?.()
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            buster: CACHE_BUSTER,
            maxAge: 24 * 60 * 60 * 1000,
            dehydrateOptions: {
              // Anything that HAS data, not only what succeeded most recently:
              // requiring `success` meant one failed refetch while offline
              // evicted the plan from disk, so the next launch had nothing left
              // to read (APP-007).
              shouldDehydrateQuery: query =>
                query.state.data !== undefined && shouldPersistQuery(query.queryKey),
            },
          }}
        >
          <SessionProvider>{children}</SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
