import { useMyRooms } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'

/** Dates happening now. A guest belongs to one room and reaches it through its link. */
export function useLiveRoomCount(): number {
  const { status } = useSession()
  const rooms = useMyRooms({ status: 'active', enabled: status === 'user' })
  return rooms.data?.pages[0]?.items?.length ?? 0
}
