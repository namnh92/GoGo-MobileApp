import type { RoomListItem } from '@/shared/api/types'
import type { MessageKey } from '@/shared/i18n/types'

export type BannerState = 'collecting' | 'matching' | 'matched' | 'ready' | 'scheduled' | 'active' | 'unknown'

/** The home list is selected across memberships by the server. Preference
 * completion counts are not vote counts; matching alone does not prove voting. */
export function roomBanner(room: RoomListItem, now = Date.now()): {
  state: BannerState; status: MessageKey; secondary: MessageKey; cta: MessageKey
  destination: `/room/${string}` | `/plans/${string}` | `/plans/${string}/active`
} {
  const start = Date.parse(room.startAt ?? room.scheduledDate ?? '')
  const state: BannerState = room.status === 'active' ? 'active'
    : room.status === 'collecting' ? 'collecting'
    : room.status === 'matching' ? 'matching'
    : room.status === 'ready' && room.planId && start > now ? 'scheduled'
    : room.status === 'ready' ? room.planId ? 'ready' : 'matched' : 'unknown'
  const destination = room.planId && state === 'active' ? `/plans/${room.planId}/active` as const
    : room.planId && (state === 'ready' || state === 'scheduled') ? `/plans/${room.planId}` as const
    : state === 'matched' ? `/room/${room.id}/match-result` as const
    : state === 'collecting' ? `/room/${room.id}/preference` as const : `/room/${room.id}` as const
  return {
    state, destination,
    status: `home.banner.${state}.status`, secondary: `home.banner.${state}.body`,
    cta: state === 'matched' ? 'home.banner.viewResult' : state === 'ready' || state === 'scheduled' ? 'home.banner.viewPlan'
      : state === 'active' && room.planId ? 'home.banner.continueDate'
      : state === 'collecting' ? 'home.banner.preferences' : 'discovery.enterRoom',
  }
}
