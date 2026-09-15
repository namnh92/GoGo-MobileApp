import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * GoGo-MobileApp#253 — whether the device is online, as TanStack Query sees it.
 *
 * `bindAppStateToQueryClient` feeds `onlineManager` from expo-network, so this
 * is the same signal that pauses every query. That is why a screen cannot learn
 * it from the query itself: offline, a refetch is paused rather than failed, so
 * there is no error to react to and cached data looks exactly like fresh data.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    notify => onlineManager.subscribe(() => notify()),
    () => onlineManager.isOnline(),
    () => true,
  )
}
