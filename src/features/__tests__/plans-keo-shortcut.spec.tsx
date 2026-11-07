import { useEffect, useReducer } from 'react'
import { View } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import '@/shared/i18n'

/**
 * #471 — "Kèo" in Cá nhân opens Kế hoạch on "Sắp tới". Both tabs stay mounted,
 * and pushing to a mounted tab only changes its params, so the second tap
 * (same destination, same screen) must still be seen. The mocked router does
 * what expo-router does here: it hands the params to the mounted screen.
 */

const mockPush = jest.fn()
const mockParams: { value: Record<string, string> } = { value: {} }
const mockRedraw: { fn: () => void } = { fn: () => undefined }

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (target: unknown) => {
      mockPush(target)
      if (typeof target === 'object' && target) mockParams.value = (target as { params?: Record<string, string> }).params ?? {}
      mockRedraw.fn()
    },
    replace: jest.fn(),
  }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => mockParams.value,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ session: { kind: 'user', userId: 'u' }, status: 'user', signOut: jest.fn() }),
}))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/api', () => {
  const idle = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() }
  const rooms = {
    data: { pages: [{ items: [] }] },
    isPending: false, isError: false, isFetching: false, isFetchingNextPage: false,
    hasNextPage: false, isFetchNextPageError: false, error: null, dataUpdatedAt: 0,
    fetchNextPage: jest.fn(), refetch: jest.fn(),
  }
  return {
    ...jest.requireActual('@/shared/api'),
    useTaxonomies: () => ({ data: { kinds: {} } }),
    useMe: () => idle, useSaved: () => idle, useMyReviews: () => idle, useNotificationSettings: () => idle,
    useMyRooms: (options: { status: string }) => { mockStatusSeen.push(options.status); return rooms },
  }
})
const mockStatusSeen: string[] = []

import PlansScreen from '@/features/tabs/plans.view'
import ProfileScreen from '@/features/tabs/profile.view'

/** The two tabs, both mounted, as the tab navigator keeps them. */
function Tabs() {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    mockRedraw.fn = redraw
  }, [redraw])
  return (
    <View>
      <ProfileScreen />
      <PlansScreen />
    </View>
  )
}

const selected = (name: string) => screen.getByRole('tab', { name }).props.accessibilityState?.selected === true
const chooseHistory = () => fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử' }))
const tapKeo = () => fireEvent.press(screen.getByRole('button', { name: 'Kèo' }))

beforeEach(() => {
  mockPush.mockReset()
  mockParams.value = {}
  mockStatusSeen.length = 0
})

it('lands on Sắp tới after Lịch sử was chosen', async () => {
  await render(<Tabs />)
  await chooseHistory()
  expect(selected('Lịch sử')).toBe(true)
  await tapKeo()
  expect(selected('Sắp tới')).toBe(true)
  expect(selected('Lịch sử')).toBe(false)
})

it('does it again on a second tap, when the destination is the same', async () => {
  jest.useFakeTimers()
  try {
    await render(<Tabs />)
    await chooseHistory()
    await tapKeo()
    expect(selected('Sắp tới')).toBe(true)
    await chooseHistory()
    expect(selected('Lịch sử')).toBe(true)
    await act(async () => { jest.advanceTimersByTime(5) })
    await tapKeo()
    expect(selected('Sắp tới')).toBe(true)
    const [first, second] = mockPush.mock.calls.map(c => c[0].params.showUpcoming)
    expect(first).not.toBe(second)
  } finally {
    jest.useRealTimers()
  }
})

it('keeps the last choice when Kế hoạch is opened from the tab bar', async () => {
  await render(<Tabs />)
  await chooseHistory()
  await tapKeo()
  await chooseHistory()
  // Tab bar: the tab is shown again, no params change, the screen redraws.
  await act(async () => { mockRedraw.fn() })
  expect(selected('Lịch sử')).toBe(true)
  expect(mockPush).toHaveBeenCalledTimes(1)
})

it('keeps Saved and opens reviews in the merged contributions screen', async () => {
  await render(<Tabs />)
  await chooseHistory()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã lưu' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Đánh giá' }))
  expect(mockPush.mock.calls.map(c => c[0])).toEqual(['/(tabs)/saved', '/me/contributions?tab=reviews'])
  expect(selected('Lịch sử')).toBe(true)
})
