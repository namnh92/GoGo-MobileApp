import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query'
import type { Persister } from '@tanstack/react-query-persist-client'
import * as Network from 'expo-network'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { isRetryable, isUnauthorized } from './errors'
import { shouldPersistQuery } from './persist-policy'
import { forgetRoomSteps } from '@/shared/navigation/room-steps'
import { resetAssistantDrafts } from '@/shared/store/assistantDraftStore'
import { closeAssistantStreams } from './queries/use-assistant'
import { bindSessionCaches } from './session-query-cache'
import { captureSessionScope } from './session'

const MAX_RETRIES = 3

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Room, suggestion and plan state changes on other devices; a short
        // stale window keeps screens fresh without hammering the API.
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000),
        // A 401 that survived the client's refresh means the session is gone —
        // refetching on focus would only produce more 401s.
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Retried mutations must replay one Idempotency-Key per intent, so a
        // retry cannot double-apply it: endpoints with a key take it from the
        // hook (`useIntentKey`, or a per-intent key like useCastVote), never a
        // fresh default per attempt (#315 F-01).
        retry: (failureCount, error) =>
          failureCount < 2 && isRetryable(error) && !isUnauthorized(error),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10_000),
        // GoGo-MobileApp#250: with the default (`online`), a mutation — and each
        // of its retries — pauses while `onlineManager` says offline, and only a
        // later online/focus event resumes it. A wrong or missed offline signal
        // on Android left a save spinning for minutes with no error. A tap must
        // end in an answer: run regardless, so offline fails fast with a
        // NetworkError the screen shows, and the bounded retries above go out
        // on time. Retries still pause while the app is unfocused — TanStack
        // checks focus whatever the network mode.
        networkMode: 'always',
      },
    },
  })
  // Includes hydrated version snapshots, which have no mounted observer.
  client.setQueryDefaults(['taxonomies'], { gcTime: Infinity })
  bindSessionCaches(client)
  return client
}

/**
 * GoGo-MobileApp#253 — on Android a change can be read while the lost network
 * is still the active one: airplane mode arrives as `UNKNOWN` with
 * `isConnected: false` but `isInternetReachable: true`. No connection means
 * offline, whatever reachability still says.
 */
export function isNetworkOnline(state: Pick<Network.NetworkState, 'isConnected' | 'isInternetReachable'>): boolean {
  if (state.isConnected === false) return false
  return Boolean(state.isInternetReachable ?? state.isConnected)
}

/**
 * GoGo-MobileApp#253 — after a change, Android re-reads the network at these
 * delays. A change can be reported stale (airplane mode read as the Wi-Fi it
 * just lost) with no later event to correct it, which left the app online.
 */
export const NETWORK_CONFIRM_DELAYS_MS = [1000, 4000] as const

/**
 * React Native has no window focus/online events — TanStack Query needs both
 * wired manually or `refetchOnWindowFocus` / `refetchOnReconnect` never fire.
 * Returns a teardown for the app root.
 */
export function bindAppStateToQueryClient(): () => void {
  // iOS reports changes reliably, and its one-off read can time out and report
  // offline, so only Android confirms a change by reading again.
  const confirmsChanges = Platform.OS === 'android'
  let confirmations: ReturnType<typeof setTimeout>[] = []

  // The listener is the live source. The one-off read below only seeds the
  // state until the first event: on iOS it can time out (reporting offline) or
  // resolve after a newer event, and applying it then would pause every query
  // and raise a false offline signal at launch (GoGo-MobileApp#253).
  let sawEvent = false
  // Bumped by every event, so a re-read that a newer event overtook is dropped.
  let generation = 0

  function reread() {
    const startedAt = generation
    void Network.getNetworkStateAsync()
      .then(state => {
        if (generation === startedAt) onlineManager.setOnline(isNetworkOnline(state))
      })
      .catch(() => undefined)
  }

  const appStateSub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active')
    // A change while in the background may never have been reported.
    if (status === 'active' && confirmsChanges) reread()
  })

  const networkSub = Network.addNetworkStateListener(state => {
    sawEvent = true
    generation += 1
    onlineManager.setOnline(isNetworkOnline(state))
    if (!confirmsChanges) return
    confirmations.forEach(clearTimeout)
    confirmations = NETWORK_CONFIRM_DELAYS_MS.map(delay => setTimeout(reread, delay))
  })

  void Network.getNetworkStateAsync()
    .then(state => {
      if (!sawEvent) onlineManager.setOnline(isNetworkOnline(state))
    })
    .catch(() => {
      if (!sawEvent) onlineManager.setOnline(true)
    })

  return () => {
    appStateSub.remove()
    networkSub.remove()
    confirmations.forEach(clearTimeout)
  }
}

export { shouldPersistQuery }

let cacheStorageOperation: Promise<void> = Promise.resolve()
let persistence: { generation: number; persister: Persister } | undefined

function sessionPersister(): Persister {
  const scope = captureSessionScope()
  if (persistence?.generation === scope.generation) return persistence.persister
  const write = (operation: () => Promise<void>) => {
    const result = cacheStorageOperation.then(() => {
      if (!scope.signal.aborted) return operation()
    })
    // Drain native writes/deletes before B can touch the same storage key.
    cacheStorageOperation = result.catch(() => {})
    return result
  }
  const persister = createAsyncStoragePersister({
    storage: {
      getItem: key => AsyncStorage.getItem(key),
      setItem: (key, value) => write(() => AsyncStorage.setItem(key, value)),
      removeItem: key => write(() => AsyncStorage.removeItem(key)),
    },
    key: 'gogo.query-cache',
    throttleTime: 2000,
  })
  const bound: Persister = {
    persistClient: client => persister.persistClient({ ...client, clientState: { ...client.clientState, mutations: [] } }),
    removeClient: () => persister.removeClient(),
    restoreClient: async () => {
      const saved = await persister.restoreClient()
      return scope.signal.aborted ? undefined : saved
    },
  }
  persistence = { generation: scope.generation, persister: bound }
  return bound
}

export const queryPersister: Persister = {
  persistClient: client => sessionPersister().persistClient(client),
  removeClient: () => sessionPersister().removeClient(),
  restoreClient: () => sessionPersister().restoreClient(),
}

/**
 * Logout must leave no room data behind (RULE-MOB-OFFLINE). Clears the
 * account cache and the persisted copy. Public administrative queries survive
 * so observers keep the startup version check across session boundaries.
 */
export async function purgeCachedUserData(queryClient: QueryClient, scope = captureSessionScope()): Promise<void> {
  scope.assert()
  // Which rooms' runs and plans were already shown belongs to the account too:
  // the next one to sign in on this device has seen none of them (#198).
  forgetRoomSteps()
  // GoGo AI (#378): no reply keeps streaming into the cache, no unsent
  // question or draft is left for the next account, and no conversation
  // stays in memory (none is ever written to disk).
  closeAssistantStreams()
  resetAssistantDrafts()
  queryClient.removeQueries({ predicate: query => query.queryKey[0] !== 'administrative' })
  queryClient.getMutationCache().clear()
  await queryPersister.removeClient()
}
