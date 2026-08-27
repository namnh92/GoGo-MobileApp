import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { RoomSummary } from '@/shared/api'

/**
 * TEMPORARY WORKAROUND for the missing `GET /rooms` (GoGo-BE#152).
 *
 * The contract exposes no room list, so a room is reachable only by id and a
 * user who leaves the flow loses it entirely. Home and Plans read this to offer
 * a way back in.
 *
 * This is **not** a source of truth: it only knows about rooms opened on this
 * device, and it goes stale the moment anything changes elsewhere. Once
 * `GET /rooms` exists, the server owns the list and this store is demoted to a
 * cache / offline fallback.
 *
 * Facts only, and never an invite code: codes are credentials and belong
 * nowhere near unencrypted storage.
 */
export interface RecentRoom {
  roomId: string
  title?: string
  type: RoomSummary['type']
  status: RoomSummary['status']
  participantCount: number
  lastOpenedAt: string
}

const MAX_RECENT_ROOMS = 10

interface RecentRoomsState {
  rooms: RecentRoom[]
  remember: (room: RoomSummary) => void
  forget: (roomId: string) => void
  clear: () => void
}

export const useRecentRoomsStore = create<RecentRoomsState>()(
  persist(
    set => ({
      rooms: [],
      remember: room =>
        set(state => {
          const entry: RecentRoom = {
            roomId: room.id,
            title: room.title,
            type: room.type,
            status: room.status,
            participantCount: room.participantCount,
            lastOpenedAt: new Date().toISOString(),
          }
          const others = state.rooms.filter(candidate => candidate.roomId !== room.id)
          return { rooms: [entry, ...others].slice(0, MAX_RECENT_ROOMS) }
        }),
      forget: roomId =>
        set(state => ({ rooms: state.rooms.filter(room => room.roomId !== roomId) })),
      clear: () => set({ rooms: [] }),
    }),
    {
      name: 'gogo.recent-rooms',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)

/** Logout must leave no trace of which rooms this device visited. */
export function clearRecentRooms(): void {
  useRecentRoomsStore.getState().clear()
}
