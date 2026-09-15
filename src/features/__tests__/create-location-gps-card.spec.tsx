import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'

/**
 * #207 (ADM-202) — the device position and a picked area exclude each other.
 * After a position is replaced by an area, the position card must read as an
 * unselected offer again: on device it kept the last fix ("P. Từ Liêm") under
 * a card that was correctly not selected.
 *
 * The location hook is faked with real state, because the bug lives in the gap
 * between the hook (still `granted`) and the draft (no position any more).
 */

const mockLocation: { result: { status: string; lat?: number; lng?: number; label?: string | null } } = {
  result: { status: 'denied' },
}

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/location/use-current-location', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    useCurrentLocation: () => {
      const [state, setState] = React.useState<unknown>({ status: 'idle' })
      return {
        state,
        request: async () => {
          setState(mockLocation.result)
          return mockLocation.result
        },
        reset: () => setState({ status: 'idle' }),
      }
    },
  }
})

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: null }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ homeAdministrativeArea: null }),
}))

jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({
    data: { datasetVersion: 'ds-2026' },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useAdministrativeUnits: () => ({ data: [], isPending: false, isError: false, error: null, refetch: jest.fn() }),
}))

// The picker has its own spec; here it only has to hand back a selection.
jest.mock('@/shared/administrative/administrative-picker.view', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    AdministrativePicker: ({ onChange }: { onChange: (next: unknown) => void }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          onPress: () =>
            onChange({
              datasetVersion: 'ds-2026',
              provinceCode: '01',
              provinceName: 'Thành phố Hà Nội',
              communeCode: '00004',
              communeName: 'Phường Ba Đình',
            }),
        },
        React.createElement(Text, null, 'Chọn tỉnh/thành phố'),
      ),
  }
})

import CreateLocationScreen from '@/features/create-date/create-location.view'
import { useRoomStore } from '@/shared/store/roomStore'

const OFFER = 'Chạm để dùng vị trí của bạn'
const FIX = 'P. Từ Liêm'

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  mockLocation.result = { status: 'granted', lat: 21.04, lng: 105.76, label: FIX }
})

it('shows the fix while the position is selected, and the offer again once an area replaces it', async () => {
  const view = await renderScreen(<CreateLocationScreen />)
  const card = () => view.getByRole('radio')

  await press(view.getByText(OFFER))
  expect(view.getByText(FIX)).toBeTruthy()
  expect(card().props.accessibilityState).toMatchObject({ selected: true })

  await press(view.getByText('Chọn tỉnh/thành phố'))
  expect(useRoomStore.getState().originLat).toBeNull()
  expect(view.queryByText(FIX)).toBeNull()
  expect(view.getByText(OFFER)).toBeTruthy()
  expect(card().props.accessibilityState).toMatchObject({ selected: false })

  // Taking the position back shows the fix again.
  await press(view.getByText(OFFER))
  expect(view.getByText(FIX)).toBeTruthy()
  expect(card().props.accessibilityState).toMatchObject({ selected: true })
})

it('falls back to the generic fix line when the position has no label', async () => {
  mockLocation.result = { status: 'granted', lat: 21.04, lng: 105.76, label: null }
  const view = await renderScreen(<CreateLocationScreen />)

  await press(view.getByText(OFFER))
  expect(view.getByText('Đã lấy được vị trí của bạn')).toBeTruthy()

  await press(view.getByText('Chọn tỉnh/thành phố'))
  expect(view.queryByText('Đã lấy được vị trí của bạn')).toBeNull()
  expect(view.getByText(OFFER)).toBeTruthy()
})

/**
 * Decision (#207 review): a refused or failed request after a successful fix
 * changes nothing in the draft. `useDeviceLocation` returns before touching
 * it, so the earlier position stays the choice until the user makes another
 * one, and the notice under the card points at the area picker. The position
 * was taken with permission at the time; silently dropping it on a later
 * refresh would also drop the distance the user set.
 */
describe('a later refusal after a fix', () => {
  it.each([
    ['denied', 'Chưa có quyền vị trí. Chọn khu vực thủ công bên dưới nhé.'],
    ['unavailable', 'Chưa lấy được vị trí. Chọn khu vực thủ công bên dưới nhé.'],
  ])('keeps the earlier fix selected when the next request is %s', async (status, notice) => {
    const view = await renderScreen(<CreateLocationScreen />)
    await press(view.getByText(OFFER))
    expect(view.getByText(FIX)).toBeTruthy()

    mockLocation.result = { status }
    await press(view.getByRole('radio'))

    expect(useRoomStore.getState()).toMatchObject({ originLat: 21.04, originLng: 105.76, administrativeArea: null })
    expect(view.getByRole('radio').props.accessibilityState).toMatchObject({ selected: true })
    expect(view.getByText(FIX)).toBeTruthy()
    expect(view.getByText('Khoảng cách tối đa')).toBeTruthy()
    expect(view.getByText(notice)).toBeTruthy()
  })
})
