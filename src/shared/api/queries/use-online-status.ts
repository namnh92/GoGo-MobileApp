import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * GoGo-MobileApp#253 — whether the screen should tell the user they are
 * offline.
 *
 * `bindAppStateToQueryClient` feeds `onlineManager` from expo-network, so this
 * follows the same signal that pauses every query. A screen cannot learn it from
 * the query itself: offline, a refetch is paused rather than failed, so there is
 * no error to react to and cached data looks exactly like fresh data.
 *
 * The signal is debounced one way only. Offline is reported after
 * `OFFLINE_SIGNAL_DELAY_MS` of continuous offline, so a Wi-Fi↔cellular handover
 * does not flash a bar; reconnecting clears it at once.
 */
export const OFFLINE_SIGNAL_DELAY_MS = 1500

let signalOnline = true
let offlineSpells = 0
let pendingOffline: ReturnType<typeof setTimeout> | undefined
let watching = false
const listeners = new Set<() => void>()

function publish(online: boolean) {
  if (signalOnline === online) return
  signalOnline = online
  if (!online) offlineSpells += 1
  listeners.forEach(listener => listener())
}

function onConnectivity(online: boolean) {
  if (online) {
    clearTimeout(pendingOffline)
    pendingOffline = undefined
    publish(true)
    return
  }
  if (!signalOnline || pendingOffline !== undefined) return
  pendingOffline = setTimeout(() => {
    pendingOffline = undefined
    publish(false)
  }, OFFLINE_SIGNAL_DELAY_MS)
}

function subscribe(listener: () => void): () => void {
  // One app-lifetime watch, started by the first screen that asks; it only
  // ever holds a boolean and a timer.
  if (!watching) {
    watching = true
    onlineManager.subscribe(onConnectivity)
    onConnectivity(onlineManager.isOnline())
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): boolean {
  return signalOnline
}

function getServerSnapshot(): boolean {
  return true
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Increments each time the signal turns offline, so an announcement can be made
 * once per offline spell rather than once per screen or per render.
 */
export function currentOfflineSpell(): number {
  return offlineSpells
}

/**
 * A query with nothing cached that is waiting for the network. TanStack Query
 * keeps it `pending` and `paused` for as long as the device is offline, so a
 * screen that only reads `isPending` shows its skeleton forever.
 */
export function useWaitingForNetwork(query: { isPending: boolean; isPaused?: boolean }): boolean {
  const online = useOnlineStatus()
  return !online && query.isPending && query.isPaused === true
}
