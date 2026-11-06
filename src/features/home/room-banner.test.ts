import { expect, it } from 'vitest'
import type { RoomListItem } from '@/shared/api/types'
import { roomBanner } from './room-banner'

const now = Date.parse('2026-11-06T12:00:00Z')
const room: RoomListItem = {
  id: 'nearest', type: 'group', status: 'collecting', decisionMode: 'vote',
  participantCount: 7, updatedAt: '2026-11-06T11:00:00Z', myRole: 'guest', myMemberId: 'me',
}

it.each([
  [{ status: 'collecting' }, 'collecting', 'home.banner.preferences', '/room/nearest/preference'],
  [{ status: 'matching' }, 'matching', 'discovery.enterRoom', '/room/nearest'],
  [{ status: 'ready', planId: 'plan' }, 'ready', 'home.banner.viewPlan', '/plans/plan'],
  [{ status: 'ready', planId: 'plan', startAt: '2026-11-07T12:00:00Z' }, 'scheduled', 'home.banner.viewPlan', '/plans/plan'],
  [{ status: 'ready', planId: 'plan', startAt: '2026-11-05T12:00:00Z' }, 'ready', 'home.banner.viewPlan', '/plans/plan'],
  [{ status: 'active', planId: 'plan' }, 'active', 'home.banner.continueDate', '/plans/plan/active'],
  [{ status: 'active' }, 'active', 'discovery.enterRoom', '/room/nearest'],
  [{ status: 'ready' }, 'matched', 'home.banner.viewResult', '/room/nearest/match-result'],
  [{ status: 'draft' }, 'unknown', 'discovery.enterRoom', '/room/nearest'],
  [{ status: 'future_status' }, 'unknown', 'discovery.enterRoom', '/room/nearest'],
])('derives the banner from server facts (%j)', (facts, state, cta, destination) => {
  const banner = roomBanner({ ...room, ...facts } as RoomListItem, now)
  expect(banner).toEqual({ state, cta, destination, status: `home.banner.${state}.status`, secondary: `home.banner.${state}.body` })
})

it('never treats completed preference counts or decision mode as vote progress', () => {
  expect(roomBanner({ ...room, status: 'matching', memberCount: 7, completedCount: 4 }, now)).toMatchObject({
    state: 'matching', cta: 'discovery.enterRoom', secondary: 'home.banner.matching.body',
  })
})
