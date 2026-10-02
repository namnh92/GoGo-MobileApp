import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { RoomPhase } from '../realtime/room-events'
import { roomRealtimeTransport, type RoomRealtimeStatus } from '../realtime/transport'

/**
 * Keeps one room fresh while a screen is open. Screens declare the phase they
 * are showing, never a refresh interval — how freshness arrives is the
 * transport's business, so replacing polling with SSE (GoGo-BE#154) touches no
 * screen and no data hook.
 *
 * `status` is transport health for the subscription this render describes
 * (#292). `offline` also means "not subscribed" — disabled, no room id, or the
 * device offline — so it is never proof of a lost connection on its own; the
 * connectivity signal (`useOnlineStatus`) says that.
 */
export function useRoomRealtime(
  roomId: string | undefined,
  phase: RoomPhase,
  options?: { enabled?: boolean; planId?: string },
): { status: RoomRealtimeStatus } {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  /**
   * What the transport last reported, tagged with the subscription it came
   * from. Only a transport that can lose its connection reports anything.
   */
  const [reported, setReported] = useState<{ subscription: string; status: RoomRealtimeStatus } | null>(null)

  useEffect(() => onlineManager.subscribe(setOnline), [])

  // Refreshing while offline just burns battery on calls that cannot succeed,
  // and `online` is a dependency so connectivity returning resubscribes.
  const active = (options?.enabled ?? true) && Boolean(roomId) && online
  const planId = options?.planId
  const subscription = active && roomId ? subscriptionKey(roomId, phase, planId) : null

  useEffect(() => {
    if (!active || !roomId) return

    const key = subscriptionKey(roomId, phase, planId)
    // The transport replays its current status on a timer after `subscribe`,
    // so a callback can land after this subscription is gone — the previous
    // room's "live" would otherwise become this room's (#292).
    let current = true
    const unsubscribe = roomRealtimeTransport.subscribe({
      roomId,
      phase,
      queryClient,
      // A screen routed by plan id reads a key the room id alone never names.
      ...(planId ? { planId } : {}),
      onStatusChange: status => {
        if (current) setReported({ subscription: key, status })
      },
    })
    return () => {
      current = false
      // Disabled and re-enabled with the same key is a new subscription: it
      // starts from what the transport says next, never the old report.
      setReported(null)
      unsubscribe()
    }
  }, [active, roomId, phase, queryClient, planId])

  const own = reported && reported.subscription === subscription ? reported.status : null
  const status: RoomRealtimeStatus = !active
    ? 'offline'
    : (own ?? (roomRealtimeTransport.kind === 'polling' ? 'polling' : 'connecting'))

  return { status }
}

function subscriptionKey(roomId: string, phase: RoomPhase, planId: string | undefined): string {
  return `${roomId}\u0000${phase}\u0000${planId ?? ''}`
}
