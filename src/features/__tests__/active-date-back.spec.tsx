import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent } from '@testing-library/react-native'

import { failed, loaded, pending, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#470 — the active date is opened from the inbox (a date
 * reminder for a room that is running) and had no back control in any state.
 */
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)
const mockPlan: { query: QueryLike } = { query: pending() }
const mockRoom: { query: QueryLike } = { query: loaded(undefined) }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => ({ planId: 'plan-1' }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlan: () => mockPlan.query,
  useRoom: () => mockRoom.query,
  useRoomRealtime: () => ({ status: 'live' }),
  usePlanStopPlaces: () => ({
    byPlaceId: new Map([['place-1', { id: 'place-1', name: 'Quán A', addressText: 'Quận 3' }]]),
    isPending: false,
  }),
}))

import ActiveDateScreen from '@/features/active-date/active-date.view'

const stop = (status: string) => ({ id: 'stop-1', placeId: 'place-1', order: 1, durationMinutes: 60, isLocked: false, status })
const plan = (status: string) => ({ id: 'plan-1', roomId: 'room-1', status: 'current', version: 1, currency: 'VND', stops: [stop(status)] })
const room = (status: string) => loaded(roomFor('group-host', { status } as never))

async function open() {
  return renderScreen(
    <QueryClientProvider client={new QueryClient()}>
      <ActiveDateScreen />
    </QueryClientProvider>,
  )
}

const states: [string, () => void][] = [
  ['loading', () => { mockPlan.query = pending() }],
  ['plan failed', () => { mockPlan.query = failed() }],
  ['room not active', () => { mockPlan.query = loaded(plan('planned')); mockRoom.query = room('completed') }],
  ['every stop done', () => { mockPlan.query = loaded(plan('completed')); mockRoom.query = room('active') }],
  ['live stop', () => { mockPlan.query = loaded(plan('planned')); mockRoom.query = room('active') }],
]

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack.mockReturnValue(true)
  mockRoom.query = room('active')
})

describe.each(states)('the active date, %s', (_name, arrange) => {
  it('offers a back control that goes back', async () => {
    arrange()
    const view = await open()

    await fireEvent.press(view.getByLabelText('Quay lại'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('goes home when nothing is under it (a cold start from a link)', async () => {
    arrange()
    mockCanGoBack.mockReturnValue(false)
    const view = await open()

    await fireEvent.press(view.getByLabelText('Quay lại'))

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
