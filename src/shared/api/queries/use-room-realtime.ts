import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { RoomPhase } from '../realtime/room-events'
import { roomRealtimeTransport, type RoomRealtimeStatus } from '../realtime/transport'

/**
 * Keeps one room fresh while a screen is open. Screens declare the phase they
 * are showing, never a refresh interval — how freshness arrives is the
 * transport's business, so replacing polling with SSE (GoGo-BE#154) touches no
 * screen and no data hook.
 */
export function useRoomRealtime(
  roomId: string | undefined,
  phase: RoomPhase,
  options?: { enabled?: boolean },
): { status: RoomRealtimeStatus } {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  /** Only a transport that can lose its connection reports anything. */
  const [reported, setReported] = useState<RoomRealtimeStatus | null>(null)

  useEffect(() => onlineManager.subscribe(setOnline), [])

  // Refreshing while offline just burns battery on calls that cannot succeed,
  // and `online` is a dependency so connectivity returning resubscribes.
  const active = (options?.enabled ?? true) && Boolean(roomId) && online

  useEffect(() => {
    if (!active || !roomId) return

    return roomRealtimeTransport.subscribe({
      roomId,
      phase,
      queryClient,
      onStatusChange: setReported,
    })
  }, [active, roomId, phase, queryClient])

  const status: RoomRealtimeStatus = !active
    ? 'offline'
    : (reported ?? (roomRealtimeTransport.kind === 'polling' ? 'polling' : 'connecting'))

  return { status }
}
