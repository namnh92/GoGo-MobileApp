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

/** Bumping this discards every persisted cache — use it when a DTO shape changes. */
const CACHE_BUSTER = 'gogo.v1.0.0-alpha.1'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  useEffect(() => bindAppStateToQueryClient(), [])

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
              shouldDehydrateQuery: query =>
                query.state.status === 'success' && shouldPersistQuery(query.queryKey),
            },
          }}
        >
          <SessionProvider>{children}</SessionProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
