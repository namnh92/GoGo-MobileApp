import { QueryClient } from '@tanstack/react-query'

/**
 * GoGo-MobileApp#198 review — which rooms' runs and plans the lobby has already
 * shown is the account's data. Kept across a sign-out, the next account on the
 * device would never be moved on in a room the previous one had visited.
 */
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}))

import { purgeCachedUserData } from '@/shared/api/query-client'
import { markRoomStepShown, planStep, runStep, wasRoomStepShown } from '@/shared/navigation/room-steps'

const ROOM_ID = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const RUN_ID = '88c56032-0f4e-4d1a-9b7c-2e5d6f7a8b9c'
const PLAN_ID = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

it("forgets the steps shown in every room when the account's data is purged", async () => {
  markRoomStepShown(ROOM_ID, runStep(RUN_ID))
  markRoomStepShown(ROOM_ID, planStep(PLAN_ID))

  await purgeCachedUserData(new QueryClient())

  expect(wasRoomStepShown(ROOM_ID, runStep(RUN_ID))).toBe(false)
  expect(wasRoomStepShown(ROOM_ID, planStep(PLAN_ID))).toBe(false)
})
