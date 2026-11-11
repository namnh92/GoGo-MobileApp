import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { failed, loaded, pausedOffline, pending, renderScreen, type QueryLike } from './harness'

/**
 * #296 F-03: the floating footer on the mood step also covers the skeleton and
 * the error branch, so both pad by the bar's height like the scrolling list.
 */

let mockTaxonomies: QueryLike = pending()
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useTaxonomies: () => mockTaxonomies,
  useCreateRoom: () => ({ isPending: false, mutateAsync: jest.fn() }),
}))

import CreateMoodScreen from '@/features/create-date/create-mood.view'

type View = Awaited<ReturnType<typeof renderScreen>>

async function layoutFooter(view: View, height: number) {
  await act(async () => {
    fireEvent(view.getByTestId('create-footer'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } })
  })
}
const paddingBottom = (view: View, testID: string) =>
  StyleSheet.flatten(view.getByTestId(testID).props.style).paddingBottom as number

it.each([
  ['pending', () => pending(), 'create-mood-pending'],
  ['error', () => failed(), 'create-mood-error'],
])('pads the %s branch by the footer height', async (_label, make, testID) => {
  mockTaxonomies = make()
  const view = await renderScreen(<CreateMoodScreen />)
  await layoutFooter(view, 100)
  // 100pt bar + 16pt gap; the jest safe-area mock reports a zero bottom inset.
  expect(paddingBottom(view, testID)).toBeGreaterThanOrEqual(100)
})

it('shows an explicit empty state while preserving optional taxonomy submission', async () => {
  mockTaxonomies = loaded({ kinds: {} })
  const view = await renderScreen(<CreateMoodScreen />)
  expect(view.getByTestId('create-mood-empty')).toBeTruthy()
  expect(view.getByText('Chưa có tiêu chí')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Tạo GoGo Room' }).props.accessibilityState.disabled).toBe(false)
})

it('renders paused offline separately from first-load skeletons', async () => {
  mockTaxonomies = pausedOffline()
  const view = await renderScreen(<CreateMoodScreen />)
  expect(view.getByTestId('create-mood-offline')).toBeTruthy()
  expect(view.queryByTestId('create-mood-pending')).toBeNull()
  expect(view.getByRole('button', { name: 'Tạo GoGo Room' }).props.accessibilityState.disabled).toBe(true)
})

it('renders only API taxonomy chips and exposes their selected state', async () => {
  mockTaxonomies = loaded({ kinds: { mood: [{ key: 'chill', labels: { vi: 'Chill trò chuyện' } }], setting: [], spending_style: [] } })
  const view = await renderScreen(<CreateMoodScreen />)
  const chip = view.getByRole('checkbox', { name: 'Chill trò chuyện' })
  await fireEvent.press(chip)
  expect(view.getByRole('checkbox', { name: 'Chill trò chuyện' }).props.accessibilityState.checked).toBe(true)
  expect(view.queryByText('Cà phê acoustic')).toBeNull()
})
