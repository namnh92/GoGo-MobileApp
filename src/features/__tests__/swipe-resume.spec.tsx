import { fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen, roomFor as mockRoomFor } from './harness'

/**
 * #290 — coming back to a run already under way reopened the deck at the first
 * card, including the ones this person had already voted on. The server says
 * which ones those are: `GET /rooms/{id}/suggestions/current` returns `myVote`
 * per candidate. The deck starts at the first candidate without one, and a run
 * with every card decided goes on to the result, as the last swipe would.
 */

const mockReplace = jest.fn()
const mockVote = jest.fn()
type Vote = 'yes' | 'no' | 'star' | null
const mockState = {
  suggestions: {
    run: { id: 'run-1', stale: false },
    candidates: [] as { placeId: string; name: string; rank: number; myVote: Vote }[],
    votes: { mine: {}, progress: [] },
  },
  /** When the data was written: before the screen opened = a restored cache. */
  dataUpdatedAt: Number.MAX_SAFE_INTEGER,
  isPaused: false,
}
const mockUseSuggestions = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/ui/place-photo.view', () => ({ PlacePhoto: () => null }))
jest.mock('@/shared/ui/feedback', () => ({ haptic: jest.fn(), useReducedMotion: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockLoaded(mockRoomFor('group-host', { status: 'matching', decisionMode: 'vote' })),
  useCurrentSuggestions: (...args: unknown[]) => {
    mockUseSuggestions(...args)
    return { ...mockLoaded(mockState.suggestions), dataUpdatedAt: mockState.dataUpdatedAt, isPaused: mockState.isPaused }
  },
  usePlaceDetail: () => mockLoaded(null),
  useRoomRealtime: jest.fn(),
  useTaxonomyLabel: () => ({ resolve: () => null }),
  useCastVote: () => ({ mutateAsync: (...args: unknown[]) => mockVote(...args), isPending: false, isError: false }),
}))

import Swipe from '@/features/matching/swipe.view'

function deck(...votes: Vote[]) {
  deckFor('run-1', ...votes)
}

function deckFor(runId: string, ...votes: Vote[]) {
  mockState.suggestions = {
    ...mockState.suggestions,
    run: { id: runId, stale: false },
    candidates: votes.map((myVote, index) => ({
      placeId: `place-${index + 1}`,
      name: `Place ${index + 1}`,
      rank: index + 1,
      myVote,
    })),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockState.dataUpdatedAt = Number.MAX_SAFE_INTEGER
  mockState.isPaused = false
  mockVote.mockResolvedValue({ matched: false })
})

it('opens at the first card this person has not voted on', async () => {
  deck('yes', 'yes', null)
  const view = await renderScreen(<Swipe />)
  expect(view.getByText('Place 3')).toBeTruthy()
  expect(view.queryByText('Place 1')).toBeNull()
  expect(view.getByText('3 / 3')).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('votes on the card it resumed at, then finishes the run', async () => {
  deck('star', null)
  const view = await renderScreen(<Swipe />)
  await fireEvent.press(view.getByLabelText('Thích'))
  expect(mockVote).toHaveBeenCalledWith({ placeId: 'place-2', value: 'yes' })
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1/match-result')
})

it('starts at a skipped card even when a later one is decided', async () => {
  deck(null, 'no', null)
  const view = await renderScreen(<Swipe />)
  expect(view.getByText('Place 1')).toBeTruthy()
  expect(view.getByText('1 / 3')).toBeTruthy()
})

it('goes on to the result when every card is already decided', async () => {
  deck('yes', 'no')
  await renderScreen(<Swipe />)
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1/match-result')
})

it('does not jump back when the optimistic vote lands on the cached run', async () => {
  deck(null, null, null)
  const view = await renderScreen(<Swipe />)
  await fireEvent.press(view.getByLabelText('Thích'))
  await fireEvent.press(view.getByLabelText('Thích'))
  expect(view.getByText('Place 3')).toBeTruthy()
  // The cache carries only the first vote so far (the second is still in
  // flight); a reseed would pull the deck back to Place 2.
  deck('yes', null, null)
  await view.rerender(<Swipe />)
  expect(view.getByText('Place 3')).toBeTruthy()
  expect(view.getByText('3 / 3')).toBeTruthy()
})

it('keeps the same card when a vote fails and the optimistic copy rolls back', async () => {
  deck(null, null)
  mockVote.mockRejectedValueOnce(new Error('offline'))
  const view = await renderScreen(<Swipe />)
  await fireEvent.press(view.getByLabelText('Thích'))
  deck(null, null)
  await view.rerender(<Swipe />)
  expect(view.getByText('Place 1')).toBeTruthy()
  expect(view.getByText('1 / 2')).toBeTruthy()
})

describe('only a read made since the screen opened places the deck (#313 F-01)', () => {
  it('asks for a fresh read on every open', async () => {
    deck(null)
    await renderScreen(<Swipe />)
    expect(mockUseSuggestions).toHaveBeenCalledWith('room-1', { refetchOnMount: 'always' })
  })

  it('waits for the fresh read when the cache missed votes cast on another phone', async () => {
    // Restored cache: this phone never saw the two votes cast elsewhere.
    deck(null, null, null)
    mockState.dataUpdatedAt = 0
    const view = await renderScreen(<Swipe />)
    expect(view.queryByText('Place 1')).toBeNull()
    expect(view.queryByLabelText('Thích')).toBeNull()
    // The read made since opening has them.
    deck('yes', 'yes', null)
    mockState.dataUpdatedAt = Number.MAX_SAFE_INTEGER
    await view.rerender(<Swipe />)
    expect(view.getByText('Place 3')).toBeTruthy()
    expect(view.getByText('3 / 3')).toBeTruthy()
  })

  it('does not leave for the result on a cached run the host has since replaced', async () => {
    deckFor('run-1', 'yes', 'no')
    mockState.dataUpdatedAt = 0
    const view = await renderScreen(<Swipe />)
    expect(mockReplace).not.toHaveBeenCalled()
    deckFor('run-2', null, null)
    mockState.dataUpdatedAt = Number.MAX_SAFE_INTEGER
    await view.rerender(<Swipe />)
    expect(view.getByText('Place 1')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says it is offline instead of offering a cached deck it cannot confirm', async () => {
    deck('yes', null)
    mockState.dataUpdatedAt = 0
    mockState.isPaused = true
    const view = await renderScreen(<Swipe />)
    expect(view.queryByLabelText('Thích')).toBeNull()
    expect(view.getByText('Không có kết nối')).toBeTruthy()
  })
})
