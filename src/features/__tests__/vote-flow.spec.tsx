import { act, fireEvent } from '@testing-library/react-native'
import { loaded as mockLoaded, renderScreen, roomFor } from './harness'
import { ApiError } from '@/shared/api/errors'

const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockFinalize = jest.fn()
const mockVote = jest.fn()
const mockRegenerate = jest.fn()
const mockReset = jest.fn()
const mockState = {
  room: roomFor('group-host', { status: 'matching', decisionMode: 'vote' }),
  suggestions: { run: { id: 'run-1', stale: false }, candidates: [
    { placeId: 'place-1', name: 'Place One', rank: 1 },
    { placeId: 'place-2', name: 'Place Two', rank: 2 },
  ], votes: { mine: {}, progress: [] as { placeId: string; points: number; yes: number }[] } },
  error: null as Error | null,
  regenerateError: null as Error | null,
}
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockLoaded(mockState.room),
  useCurrentSuggestions: () => mockLoaded(mockState.suggestions),
  useCurrentPlan: () => mockLoaded(null),
  usePlaceDetail: () => mockLoaded(null),
  useRoomRealtime: jest.fn(),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useFinalizeVotes: () => ({ mutateAsync: (...args: unknown[]) => mockFinalize(...args), reset: mockReset, isPending: false, isError: Boolean(mockState.error), error: mockState.error }),
  useGenerateSuggestions: () => ({ mutate: (...args: unknown[]) => mockRegenerate(...args), isPending: false, isError: Boolean(mockState.regenerateError), error: mockState.regenerateError }),
  useStartMatching: () => ({ mutate: jest.fn(), isPending: false }),
  useCastVote: () => ({ mutateAsync: (...args: unknown[]) => mockVote(...args), isPending: false, isError: Boolean(mockState.error) }),
}))
import MatchResult from '@/features/matching/match-result.view'
import Swipe from '@/features/matching/swipe.view'
import Matching from '@/features/matching/matching.view'
import { resetRoomStepsForTests, runStep, wasRoomStepShown } from '@/shared/navigation/room-steps'

beforeEach(() => {
  jest.clearAllMocks()
  mockState.room = roomFor('group-host', { status: 'matching', decisionMode: 'vote' })
  mockState.suggestions.run.stale = false
  mockState.suggestions.votes = { mine: {}, progress: [] }
  mockState.error = null
  mockState.regenerateError = null
  mockFinalize.mockResolvedValue({ planId: 'plan-1' })
  mockVote.mockResolvedValue({ matched: false })
})
it('never finalizes a vote room without votes', async () => {
  const view = await renderScreen(<MatchResult />)
  await fireEvent.press(view.getByText('Chốt phương án này'))
  expect(mockFinalize).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('Xem và bình chọn'))
  expect(mockPush).toHaveBeenCalledWith('/room/room-1/swipe')
})
it('finalizes tally with no explicit place, including a tie', async () => {
  mockState.suggestions.votes.progress = [{ placeId: 'place-1', points: 1, yes: 1 }, { placeId: 'place-2', points: 1, yes: 1 }]
  const view = await renderScreen(<MatchResult />)
  await fireEvent.press(view.getByText('Chốt phương án này'))
  expect(mockFinalize).toHaveBeenCalledWith({})
  expect(mockReplace).toHaveBeenCalledWith('/plans/plan-1')
})
it('host mode sends its selected candidate', async () => {
  mockState.room.decisionMode = 'host'
  const view = await renderScreen(<MatchResult />)
  await fireEvent.press(view.getByLabelText('Place Two'))
  await fireEvent.press(view.getByText('Chốt phương án này'))
  expect(mockFinalize).toHaveBeenCalledWith({ placeId: 'place-2' })
})
it.each(['match', 'member', 'stale'])('blocks inappropriate finalization: %s', async kind => {
  if (kind === 'match') mockState.room.decisionMode = 'match'
  if (kind === 'member') mockState.room.myRole = 'member'
  if (kind === 'stale') { mockState.room.decisionMode = 'host'; mockState.suggestions.run.stale = true }
  const view = await renderScreen(<MatchResult />)
  const button = view.queryByText('Chốt phương án này')
  if (button) await fireEvent.press(button)
  expect(mockFinalize).not.toHaveBeenCalled()
})
it('explains NO_VOTES instead of suggesting a blind retry', async () => {
  mockState.error = new ApiError(409, { code: 'NO_VOTES', message: 'no votes' })
  const view = await renderScreen(<MatchResult />)
  expect(view.getByText('Chưa có phiếu. Hãy bình chọn trước khi chốt.')).toBeTruthy()
})
it.each(['vote', 'match', 'host'] as const)('routes %s to the correct next step', async mode => {
  mockState.room.decisionMode = mode
  jest.useFakeTimers()
  try {
    await renderScreen(<Matching />)
    await act(async () => { jest.advanceTimersByTime(800) })
    expect(mockReplace).toHaveBeenCalledWith(`/room/room-1/${mode === 'host' ? 'match-result' : 'swipe'}`)
  } finally { jest.useRealTimers() }
})
it('keeps a failed vote on the same card', async () => {
  mockVote.mockRejectedValue(new Error('offline'))
  const view = await renderScreen(<Swipe />)
  await fireEvent.press(view.getByLabelText('Thích'))
  expect(mockVote).toHaveBeenCalledWith({ placeId: 'place-1', value: 'yes' })
  expect(view.getByText('Place One')).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
})
it('waits for a successful vote before advancing', async () => {
  const view = await renderScreen(<Swipe />)
  await fireEvent.press(view.getByLabelText('Thích'))
  expect(view.getByText('Place Two')).toBeTruthy()
  await fireEvent.press(view.getByLabelText('Thích'))
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1/match-result')
})

it('ignores a second finalize tap while the first is unresolved', async () => {
  mockState.room.decisionMode = 'host'
  let finish!: (value: unknown) => void
  mockFinalize.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const view = await renderScreen(<MatchResult />)
  await fireEvent.press(view.getByText('Chốt phương án này'))
  await fireEvent.press(view.getByText('Chốt phương án này'))
  expect(mockFinalize).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ planId: 'plan-1' }) })
})

describe('stale ranking recovery (#198)', () => {
  it('turns a STALE_SUGGESTIONS refusal into the host refreshing the ranking', async () => {
    mockState.suggestions.votes.progress = [{ placeId: 'place-1', points: 1, yes: 1 }]
    mockState.error = new ApiError(409, { code: 'STALE_SUGGESTIONS', message: 'stale' })
    const view = await renderScreen(<MatchResult />)
    expect(view.getByText(/gợi ý này đã cũ/)).toBeTruthy()
    // No blind retry: neither the generic failure nor a finalize that would be refused again.
    expect(view.queryByText('Chưa chốt được. Thử lại nhé.')).toBeNull()
    expect(view.queryByText('Chốt phương án này')).toBeNull()
    expect(view.queryByText('Cho phương án khác')).toBeNull()
    await fireEvent.press(view.getByText('Tạo lại gợi ý'))
    expect(mockRegenerate).toHaveBeenCalledTimes(1)
    const options = mockRegenerate.mock.calls[0][1] as { onSuccess: () => void }
    options.onSuccess()
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('tells a member to wait for the host instead of offering the refresh', async () => {
    mockState.room.myRole = 'member'
    mockState.suggestions.run.stale = true
    const view = await renderScreen(<MatchResult />)
    expect(view.getByText(/gợi ý này đã cũ/)).toBeTruthy()
    expect(view.getByText('Đợi chủ phòng tạo lại gợi ý.')).toBeTruthy()
    expect(view.queryByText('Tạo lại gợi ý')).toBeNull()
    expect(view.queryByText('Cho phương án khác')).toBeNull()
  })

  it('explains a refresh that lost a race with a preference change', async () => {
    mockState.suggestions.run.stale = true
    mockState.regenerateError = new ApiError(409, { code: 'STALE_SUGGESTIONS', message: 'changed' })
    const view = await renderScreen(<MatchResult />)
    expect(view.getByText('Có người vừa đổi lựa chọn trong lúc tạo gợi ý. Thử lại nhé.')).toBeTruthy()
  })
})

describe('the run a decision screen shows (#198)', () => {
  it.each([['deck', Swipe], ['result', MatchResult]] as const)('the %s records it, so the lobby never sends anyone back to it', async (_name, Screen) => {
    resetRoomStepsForTests()
    await renderScreen(<Screen />)
    expect(wasRoomStepShown('room-1', runStep('run-1'))).toBe(true)
  })
})
