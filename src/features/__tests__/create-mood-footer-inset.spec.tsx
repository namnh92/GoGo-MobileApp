import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { failed, pending, renderScreen, type QueryLike } from './harness'

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
