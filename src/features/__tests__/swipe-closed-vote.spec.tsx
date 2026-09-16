import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen, roomFor } from './harness'
import { ApiError } from '@/shared/api/errors'

/**
 * #198 (PX-2 in #218) — once the room has moved on, a plan chosen here or on
 * another phone, voting is closed and the server refuses every vote with
 * 409 ROOM_NOT_MATCHING. The deck stayed live, polled, and answered each tap
 * with "try again on this card", which no retry could ever satisfy.
 */

const mockReplace = jest.fn()
const mockVote = jest.fn()
const NOT_MATCHING = new ApiError(409, { code: 'ROOM_NOT_MATCHING', message: 'Voting is not open for this room' })

const mockState = {
  room: { ...mockLoaded(roomFor('group-guest', { status: 'matching', decisionMode: 'vote' })), isSuccess: true, dataUpdatedAt: 0 },
  voteError: null as Error | null,
}
const mockSuggestions = {
  run: { id: 'run-1', stale: false },
  candidates: [
    { placeId: 'place-1', name: 'Place One', rank: 1 },
    { placeId: 'place-2', name: 'Place Two', rank: 2 },
  ],
  votes: { mine: {}, progress: [] },
}

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockState.room,
  useCurrentSuggestions: () => mockLoaded(mockSuggestions),
  usePlaceDetail: () => mockLoaded(null),
  useRoomRealtime: jest.fn(),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCastVote: () => ({
    mutateAsync: (...args: unknown[]) => mockVote(...args),
    isPending: false,
    isError: mockState.voteError !== null,
    error: mockState.voteError,
  }),
}))

import Swipe from '@/features/matching/swipe.view'

const RETRY_COPY = 'Chưa lưu được lựa chọn. Hãy thử lại trên thẻ này.'
const CLOSED_COPY = 'Phòng đã chốt xong, không bình chọn thêm được nữa.'

function roomRead(status: 'matching' | 'ready' | 'collecting', readAt: number) {
  mockState.room = {
    ...mockLoaded(roomFor('group-guest', { status, decisionMode: 'vote' })),
    isSuccess: true,
    dataUpdatedAt: readAt,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  roomRead('matching', 0)
  mockState.voteError = null
  mockVote.mockResolvedValue({ matched: false })
})

describe('a vote refused because the room moved on', () => {
  it('takes the member to the room, which routes on to the plan, instead of asking for a retry', async () => {
    mockVote.mockRejectedValue(NOT_MATCHING)
    const view = await renderScreen(<Swipe />)
    await fireEvent.press(view.getByLabelText('Thích'))
    expect(mockVote).toHaveBeenCalledWith({ placeId: 'place-1', value: 'yes' })
    expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it('says voting has closed, not "try again on this card"', async () => {
    mockState.voteError = NOT_MATCHING
    const view = await renderScreen(<Swipe />)
    expect(view.getByText(CLOSED_COPY)).toBeTruthy()
    expect(view.queryByText(RETRY_COPY)).toBeNull()
  })

  it('still keeps the card for a retry when the vote failed for any other reason', async () => {
    const failure = new ApiError(500, { code: 'INTERNAL', message: 'boom' })
    mockVote.mockRejectedValue(failure)
    mockState.voteError = failure
    const view = await renderScreen(<Swipe />)
    await fireEvent.press(view.getByLabelText('Thích'))
    expect(view.getByText('Place One')).toBeTruthy()
    expect(view.getByText(RETRY_COPY)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('a deck whose room has moved on', () => {
  it.each(['ready', 'collecting'] as const)(
    'leaves for the room once a read since opening says %s',
    async status => {
      const view = await renderScreen(<Swipe />)
      expect(mockReplace).not.toHaveBeenCalled()
      roomRead(status, Date.now() + 1000)
      await act(async () => {
        view.rerender(<Swipe />)
      })
      expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
      await act(async () => {
        view.rerender(<Swipe />)
      })
      expect(mockReplace).toHaveBeenCalledTimes(1)
    },
  )

  it('does not move on a restored read from before the screen opened', async () => {
    roomRead('ready', 1)
    await renderScreen(<Swipe />)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('stays while a fresh read says the room is still matching', async () => {
    const view = await renderScreen(<Swipe />)
    roomRead('matching', Date.now() + 1000)
    await act(async () => {
      view.rerender(<Swipe />)
    })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(view.getByText('Place One')).toBeTruthy()
  })
})
