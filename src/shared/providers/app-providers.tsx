import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState, type ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import {
  bindAppStateToQueryClient,
  createQueryClient,
  queryPersister,
  shouldPersistQuery,
} from '@/shared/api/query-client'

import { useTaxonomies } from '@/shared/api/queries/use-preferences'
import { retainTaxonomies } from '@/shared/api/persist-policy'

import { SessionProvider } from './session-provider'
import { initializeAcquisitionSdk } from '@/shared/acquisition/bootstrap'
import { initializePushSdk } from '@/shared/notifications/bootstrap'
import { devicePromotionsStore } from '@/shared/notifications/device-promotions-store'
import { initializePushIdentity } from '@/shared/notifications/identity-bootstrap'
import { retryInitialization } from '@/shared/notifications/initialize'
import { startNotificationClicks } from '@/shared/notifications/notification-clicks-bootstrap'
import { useAccentBootstrap } from '@/shared/theme/use-accent-bootstrap'
import { markSplashHidden } from '@/shared/ui/splash-state'
import { ToastProvider } from '@/shared/ui/toast.view'

/** Bumping this discards every persisted cache — use it when a DTO shape changes. */
const CACHE_BUSTER = 'gogo.v1.0.0-alpha.3'

/** Runs after persistence hydration; every screen shares this locale query. */
function TaxonomyBootstrap() {
  useTaxonomies()
  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  const accentReady = useAccentBootstrap()

  useEffect(() => bindAppStateToQueryClient(), [])
  useEffect(() => initializeAcquisitionSdk(), [])
  // The root layout held the splash for exactly this: children render
  // underneath it meanwhile (session hydration does not wait on a colour), and
  // it lifts once the saved accent is the one on screen.
  useEffect(() => {
    if (!accentReady) return
    // Marked either way: a failed hide leaves nothing to wait for (#366).
    void SplashScreen.hideAsync().catch(() => {}).finally(markSplashHidden)
  }, [accentReady])
  useEffect(() => {
    void devicePromotionsStore.load()
    let cancelled = false
    let stopClicks: (() => void) | undefined
    let stopIdentity: (() => void) | undefined
    void retryInitialization(initializePushSdk).then(result => {
      if (result !== 'ready' || cancelled) return
      // #256 — first, so the tap that launched the app is routed without
      // waiting on identity; `NotificationClickRouter` holds it until ready.
      // A listener that cannot register costs tap routing, never identity.
      try {
        stopClicks = startNotificationClicks()
      } catch {
        if (__DEV__) console.warn('push_click_listener_unavailable')
      }
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
            persister: retainTaxonomies(queryPersister),
            buster: CACHE_BUSTER,
            // The persister expires account data after 24h, retaining public
            // taxonomy labels and ETags until their generation is replaced.
            maxAge: Infinity,
            dehydrateOptions: {
              shouldDehydrateMutation: () => false,
              // Anything that HAS data, not only what succeeded most recently:
              // requiring `success` meant one failed refetch while offline
              // evicted the plan from disk, so the next launch had nothing left
              // to read (APP-007).
              shouldDehydrateQuery: query =>
                query.state.data !== undefined && shouldPersistQuery(query.queryKey),
            },
          }}
        >
          <TaxonomyBootstrap />
          <SessionProvider>
            {/* One toast queue for the app (#381); inside the safe area it positions against. */}
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
