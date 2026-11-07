import type { RoomListItem } from '@/shared/api'
import { UPCOMING } from './room-status'

/** Only scheduled future rooms; pagination must be complete before calling this for the banner. */
export function nearestUpcomingRoom(rooms: readonly RoomListItem[], now: number): RoomListItem | undefined {
  return rooms.filter(room => UPCOMING.includes(room.status)).map(room => ({ room, time: Date.parse(room.startAt ?? room.scheduledDate ?? '') }))
    .filter(item => Number.isFinite(item.time) && item.time >= now)
    .sort((a, b) => a.time - b.time || a.room.id.localeCompare(b.room.id))[0]?.room
}
