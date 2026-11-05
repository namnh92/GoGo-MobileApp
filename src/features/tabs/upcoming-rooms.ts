import { useMyRooms, type RoomListItem } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'

/** What the Plans tab lists under "Sắp tới", and what its badge counts. */
export const UPCOMING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching', 'ready', 'active']

/**
 * The badge on the Plans tab: the same query as the "Sắp tới" list, so the two
 * agree. It reads the first page, and `more` says others may exist beyond it.
 */
export function useUpcomingRooms(): { count: number; more: boolean; live: boolean } {
  const { status } = useSession()
  const rooms = useMyRooms({ status: UPCOMING.join(','), enabled: status === 'user' })
  // A disabled query still returns its cache: after sign-out that is someone else's.
  if (status !== 'user') return { count: 0, more: false, live: false }
  const first = rooms.data?.pages[0]
  const items = first?.items?.filter(room => UPCOMING.includes(room.status)) ?? []
  return {
    count: items.length,
    more: items.length > 0 && !!first?.nextCursor,
    live: items.some(room => room.status === 'active'),
  }
}
