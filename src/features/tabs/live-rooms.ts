import { useMyRooms } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'

/** Dates happening now. A guest belongs to one room and reaches it through its link. */
export function useLiveRoomCount(): number {
  const { status } = useSession()
  const rooms = useMyRooms({ status: 'active', enabled: status === 'user' })
  // A disabled query still returns its cache: after sign-out that is someone else's.
  if (status !== 'user') return 0
  return rooms.data?.pages[0]?.items?.length ?? 0
}
