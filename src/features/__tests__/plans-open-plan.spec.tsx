import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#198 — the Plans tab counted `ready` as upcoming and so opened
 * the lobby for a room that already had its plan; on DEV the member landed on
 * the lobby again. A decided room opens its plan. A room still deciding opens
 * the lobby, which sends people on from there.
 */
const ROOM_READY = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const ROOM_ACTIVE = '6e1d2c3b-4a59-4876-8a5b-4c3d2e1f0a9b'
const ROOM_MATCHING = 'f663eea4-2b3c-4d5e-8f6a-7b8c9d0e1f2a'
const ROOM_READY_NO_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const PLAN_READY = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const PLAN_ACTIVE = '1f2e3d4c-5b6a-4798-8a6b-5c4d3e2f1a0b'

const mockPush = jest.fn()
const mockRooms = {
  data: {
    pages: [
      {
        items: [
          { id: ROOM_READY, title: 'Kèo đã chốt', status: 'ready', type: 'group', participantCount: 2, planId: PLAN_READY },
          { id: ROOM_ACTIVE, title: 'Kèo đang đi', status: 'active', type: 'couple', participantCount: 2, planId: PLAN_ACTIVE },
          { id: ROOM_MATCHING, title: 'Kèo đang bình chọn', status: 'matching', type: 'group', participantCount: 3 },
          { id: ROOM_READY_NO_ID, title: 'Kèo chốt chưa có mã', status: 'ready', type: 'group', participantCount: 2 },
        ],
      },
    ],
  },
  isPending: false,
  isError: false,
  isFetching: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  isFetchNextPageError: false,
  error: null,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
}

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => mockRooms }))

import PlansScreen from '@/features/tabs/plans.view'

beforeEach(() => mockPush.mockClear())

it.each([
  ['a ready room', 'Kèo đã chốt', `/plans/${PLAN_READY}`],
  ['an active room', 'Kèo đang đi', `/plans/${PLAN_ACTIVE}`],
  ['a room still voting', 'Kèo đang bình chọn', `/room/${ROOM_MATCHING}`],
  // No plan id on the card: the lobby resolves the current plan and opens it.
  ['a ready room whose card has no plan id', 'Kèo chốt chưa có mã', `/room/${ROOM_READY_NO_ID}`],
])('the card for %s opens %s', async (_case, title, route) => {
  const view = await renderScreen(<PlansScreen />)

  await act(async () => {
    fireEvent.press(view.getByText(title))
  })

  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith(route)
})
