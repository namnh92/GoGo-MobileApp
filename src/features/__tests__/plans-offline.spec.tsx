import { act } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'

import { renderScreen } from './harness'

import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

/**
 * GoGo-MobileApp#253 — the Plans tab offline. With rooms cached the list stays
 * and says it is the saved copy; with nothing cached the paused query used to
 * keep the skeleton on screen forever.
 */
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const NO_CONNECTION = 'Không có kết nối'

function rooms(items: unknown[] | undefined, over: Record<string, unknown> = {}) {
  return {
    data: items ? { pages: [{ items }] } : undefined,
    isPending: !items,
    isPaused: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    isFetchNextPageError: false,
    error: null,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    ...over,
  }
}

const mockRooms: { value: ReturnType<typeof rooms> } = { value: rooms([]) }

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) , useFocusEffect: () => undefined }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => mockRooms.value }))

import PlansScreen from '@/features/tabs/plans.view'

async function elapseOfflineDelay() {
  await act(async () => {
    jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
  jest.useRealTimers()
})

describe('Plans × connectivity', () => {
  it('shows the offline state, not an endless skeleton, when no rooms are cached', async () => {
    mockRooms.value = rooms(undefined, { isPaused: true })
    onlineManager.setOnline(false)
    const view = await renderScreen(<PlansScreen />)
    expect(view.queryByText(NO_CONNECTION)).toBeNull()

    await elapseOfflineDelay()
    expect(view.getByText(NO_CONNECTION)).toBeTruthy()
    expect(view.queryByText('Thử lại')).toBeNull()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })

  it('keeps the skeleton for a paused read while online', async () => {
    mockRooms.value = rooms(undefined, { isPaused: true })
    const view = await renderScreen(<PlansScreen />)
    await elapseOfflineDelay()
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })

  it('marks cached rooms as the saved copy while offline', async () => {
    mockRooms.value = rooms([{ id: 'a', title: 'Kèo cuối tuần', status: 'collecting', type: 'group', participantCount: 4 }])
    onlineManager.setOnline(false)
    const view = await renderScreen(<PlansScreen />)
    await elapseOfflineDelay()
    expect(view.getByText('Kèo cuối tuần')).toBeTruthy()
    expect(view.getByText(OFFLINE)).toBeTruthy()
  })

  it('claims no saved copy when the current tab shows no rooms', async () => {
    // Cached, but nothing in it belongs to Upcoming: the tab shows its empty state.
    mockRooms.value = rooms([{ id: 'b', title: 'Đã xong', status: 'completed', type: 'group', participantCount: 4 }])
    onlineManager.setOnline(false)
    const view = await renderScreen(<PlansScreen />)
    await elapseOfflineDelay()
    expect(view.queryByText('Đã xong')).toBeNull()
    expect(view.queryByText(OFFLINE)).toBeNull()
  })
})
