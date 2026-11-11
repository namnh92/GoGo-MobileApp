import { useAppAreaStore as mockAreaStore } from '@/shared/location/app-area'
import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'

/** #594: startup position is visible immediately; each focus refresh is silent. */
const FIX = 'P. Từ Liêm'
const mockLocation: { result: import('@/shared/location/native-location').LocationState } = {
  result: { status: 'granted', lat: 21.05, lng: 105.77, label: FIX },
}
const mockFocus: { current?: () => void } = {}
const mockRefresh = jest.fn(async () => {
  const result = mockLocation.result
  if (mockAreaStore.getState().manual) return
  if (result.status === 'granted') mockAreaStore.setState({ location: result, area: null, manual: false,
    scope: { status: 'ready', source: 'gps', position: { lat: result.lat, lng: result.lng } } })
  else mockAreaStore.setState({ location: result })
})
const mockRequest = jest.fn(async () => {
  const result = mockLocation.result
  if (result.status === 'granted') mockAreaStore.setState({ location: result, area: null, manual: false,
    scope: { status: 'ready', source: 'gps', position: { lat: result.lat, lng: result.lng } } })
  else mockAreaStore.setState({ location: result })
  return result
})
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => { mockFocus.current = callback; callback(); return () => { mockFocus.current = undefined } }, [callback])
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: mockAreaStore(state => state.location), request: mockRequest, refresh: mockRefresh }),
}))

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
    AdministrativePicker: ({ value, onChange, onValidityChange }: { value: unknown; onChange: (next: unknown) => void; onValidityChange?: (valid: boolean) => void }) => {
      React.useEffect(() => onValidityChange?.(Boolean(value)), [value, onValidityChange])
      return React.createElement(
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
      )
    },
  }
})

import CreateLocationScreen from '@/features/create-date/create-location.view'
import { useRoomStore } from '@/shared/store/roomStore'

const OFFER = 'Chọn khu vực thủ công hoặc dùng vị trí hiện tại.'
async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(element) })
}
beforeEach(() => {
  mockRefresh.mockClear()
  mockRequest.mockClear()
  mockLocation.result = { status: 'granted', lat: 21.05, lng: 105.77, label: FIX }
  mockAreaStore.setState({ area: null, manual: false, scope: { status: 'ready', source: 'gps', position: { lat: 21.04, lng: 105.76 } },
    location: { status: 'granted', lat: 21.04, lng: 105.76, label: FIX } })
  useRoomStore.getState().resetDraft()
})
it('prefills the startup position without a tap, then refreshes on entry and on focus (#594 owner)', async () => {
  let finish!: () => void
  mockRefresh.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const view = await renderScreen(<CreateLocationScreen />)
  expect(useRoomStore.getState()).toMatchObject({ originLat: 21.04, originLng: 105.76 })
  expect(view.getByRole('radio').props.accessibilityState.selected).toBe(true)
  expect(view.getByText(FIX)).toBeTruthy()
  expect(view.queryByText('Chạm để dùng vị trí của bạn')).toBeNull()
  expect(mockRefresh).toHaveBeenCalledTimes(1)
  expect(mockRequest).not.toHaveBeenCalled()
  await act(async () => { finish(); mockFocus.current?.() })
  expect(mockRefresh).toHaveBeenCalledTimes(2)
  expect(useRoomStore.getState()).toMatchObject({ originLat: 21.05, originLng: 105.77 })
  expect(mockRequest).not.toHaveBeenCalled()
})
it('manual selection uses SearchField and survives a later focus refresh (#594 owner)', async () => {
  const view = await renderScreen(<CreateLocationScreen />)
  expect(view.getByPlaceholderText('Chọn khu vực', { includeHiddenElements: true }).props.editable).toBe(false)
  await press(view.getByRole('button', { name: 'Chọn khu vực' }))
  await press(view.getByText('Chọn tỉnh/thành phố'))
  await press(view.getByText('Xác nhận'))
  expect(useRoomStore.getState()).toMatchObject({ originLat: null, originLng: null, administrativeArea: { provinceCode: '01' } })
  expect(view.getByText(OFFER)).toBeTruthy()
  await act(async () => { mockFocus.current?.() })
  expect(useRoomStore.getState().originLat).toBeNull()
  await press(view.getByRole('radio'))
  expect(view.getByText(FIX)).toBeTruthy()
  expect(view.getByRole('radio').props.accessibilityState.selected).toBe(true)
})
it('prefills the native startup fix before its area lookup completes (#594 owner)', async () => {
  mockAreaStore.setState({ scope: { status: 'resolving' } })
  mockRefresh.mockImplementationOnce(async () => {})
  const view = await renderScreen(<CreateLocationScreen />)
  expect(useRoomStore.getState()).toMatchObject({ originLat: 21.04, originLng: 105.76 })
  expect(view.getByText(FIX)).toBeTruthy()
  expect(mockRequest).not.toHaveBeenCalled()
})
it('falls back to the generic fix line without an area label', async () => {
  mockLocation.result = { status: 'granted', lat: 21.04, lng: 105.76, label: null }
  mockAreaStore.setState({ location: mockLocation.result })
  const view = await renderScreen(<CreateLocationScreen />)
  expect(view.getByText('Đã lấy được vị trí của bạn')).toBeTruthy()
})
it.each([
  ['denied', 'Chưa có quyền vị trí. Chọn khu vực thủ công bên dưới nhé.'],
  ['unavailable', 'Chưa lấy được vị trí. Chọn khu vực thủ công bên dưới nhé.'],
] as const)('renders %s on entry without a tap and keeps the manual fallback (#594 owner)', async (status, notice) => {
  mockAreaStore.setState({ scope: { status: 'resolving' }, location: { status: 'idle' } })
  mockLocation.result = { status }
  const view = await renderScreen(<CreateLocationScreen />)
  expect(view.getByText(notice)).toBeTruthy()
  expect(view.getByRole('button', { name: 'Chọn khu vực' })).toBeTruthy()
  expect(mockRequest).not.toHaveBeenCalled()
  expect(useRoomStore.getState().originLat).toBeNull()
})
it.each(['denied', 'unavailable'] as const)('retains the earlier fix when focus refresh is %s', async status => {
  const view = await renderScreen(<CreateLocationScreen />)
  mockLocation.result = { status }
  await act(async () => { mockFocus.current?.() })
  expect(useRoomStore.getState()).toMatchObject({ originLat: 21.05, originLng: 105.77, administrativeArea: null })
  expect(view.getByRole('radio').props.accessibilityState.selected).toBe(true)
  expect(view.getByText(FIX)).toBeTruthy()
})
