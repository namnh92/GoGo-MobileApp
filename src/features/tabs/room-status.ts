import type { RoomListItem } from '@/shared/api'

/** What the Plans tab lists under "Sắp tới", and what its badge counts. */
export const UPCOMING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching', 'ready', 'active']
