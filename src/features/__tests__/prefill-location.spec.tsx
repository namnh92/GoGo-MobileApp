import { act, fireEvent } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-202 (#207), ADR-0022 — the location step offers two choices that exclude
 * each other: the device position (with a distance) or a canonical
 * province/commune from the shared picker. The account area is a default
 * offered as a chip only while the draft has no choice, applied by a tap, and
 * never from a dataset that has been replaced.
 */

const mockMe: { query: QueryLike } = { query: loaded(undefined) }
const mockSession = { status: 'user' as string }
const mockVersion = { value: 'ds-2026' }
const mockLocation: { result: { status: string; lat?: number; lng?: number; label?: string | null } } = {
  result: { status: 'denied' },
}
const mockPick: { value: unknown } = { value: null }
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: { status: 'idle' }, request: async () => mockLocation.result }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status, session: null }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
}))

jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({
    data: { datasetVersion: mockVersion.value },
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
    AdministrativePicker: ({
      value,
      onChange,
    }: {
      value: { provinceName: string; communeName: string | null } | null
      onChange: (next: unknown) => void
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress: () => onChange(mockPick.value) },
        React.createElement(Text, null, value ? `Đã chọn: ${value.communeName ?? value.provinceName}` : 'Chọn tỉnh/thành phố'),
      ),
  }
})

import CreateLocationScreen from '@/features/create-date/create-location.view'
import { toCreateRoomBody, useRoomStore } from '@/shared/store/roomStore'

const AREA = {
  datasetVersion: 'ds-2026',
  provinceCode: '79',
  provinceName: 'Thành phố Hồ Chí Minh',
  communeCode: '26734',
  communeName: 'Phường Bến Thành',
}
const CHIP = /Dùng khu vực mặc định: Phường Bến Thành, Thành phố Hồ Chí Minh/

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  mockSession.status = 'user'
  mockVersion.value = 'ds-2026'
  mockLocation.result = { status: 'denied' }
  mockPick.value = AREA
  mockPush.mockClear()
  mockMe.query = loaded({ homeAdministrativeArea: { ...AREA, status: 'current' } })
})

describe('account area on the location step', () => {
  it('offers the account area while the draft has no location choice', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
  })

  it('fills the canonical codes and labels on a tap, and only then', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(useRoomStore.getState().administrativeArea).toBeNull()
    await press(view.getByText(CHIP))
    expect(useRoomStore.getState()).toMatchObject({ administrativeArea: AREA, originLat: null, originLng: null })
    expect(view.queryByText(CHIP)).toBeNull()
  })

  // RNTL 14 renders nothing after a manual unmount, which would make an absence
  // check pass vacuously: one render per case, and each asserts the step rendered.
  it('is not offered once the draft has an area', async () => {
    useRoomStore.getState().patchDraft({ administrativeArea: { ...AREA, communeCode: null, communeName: null } })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Tiếp tục')).toBeTruthy()
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is not offered once the draft has a device position', async () => {
    useRoomStore.getState().patchDraft({ originLat: 10.8, originLng: 106.7 })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Tiếp tục')).toBeTruthy()
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is not offered without an account area', async () => {
    mockMe.query = loaded({ homeAdministrativeArea: null })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Tiếp tục')).toBeTruthy()
    expect(view.queryByText(/Dùng khu vực mặc định/)).toBeNull()
  })

  it('is not offered from a replaced dataset', async () => {
    mockMe.query = loaded({ homeAdministrativeArea: { ...AREA, datasetVersion: 'old', status: 'needs_reselection' } })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Tiếp tục')).toBeTruthy()
    expect(view.queryByText(/Dùng khu vực mặc định/)).toBeNull()
  })

  it('is never offered to a guest', async () => {
    mockSession.status = 'guest'
    mockMe.query = loaded(undefined)
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Tiếp tục')).toBeTruthy()
    expect(view.queryByText(/Dùng khu vực mặc định/)).toBeNull()
  })
})

describe('position and area exclude each other', () => {
  it('choosing an area drops the device position, and using the position drops the area', async () => {
    useRoomStore.getState().patchDraft({ originLat: 10.8, originLng: 106.7 })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText('Khoảng cách tối đa')).toBeTruthy()

    await press(view.getByText('Chọn tỉnh/thành phố'))
    expect(useRoomStore.getState()).toMatchObject({ administrativeArea: AREA, originLat: null, originLng: null })
    // A distance only means something from a position.
    expect(view.queryByText('Khoảng cách tối đa')).toBeNull()

    mockLocation.result = { status: 'granted', lat: 10.77, lng: 106.69, label: 'Quận 1, TP.HCM' }
    await press(view.getByText('Chạm để dùng vị trí của bạn'))
    expect(useRoomStore.getState()).toMatchObject({ administrativeArea: null, originLat: 10.77, originLng: 106.69 })
  })

  it('continues with codes only and no distance for an area', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    await press(view.getByText('Chọn tỉnh/thành phố'))
    await press(view.getByText('Tiếp tục'))
    expect(mockPush).toHaveBeenCalledWith('/create/time')
    expect(useRoomStore.getState().radiusM).toBeNull()

    useRoomStore.getState().patchDraft({ budgetAmount: 300_000 })
    const constraint = toCreateRoomBody(useRoomStore.getState()).constraint
    expect(constraint.administrativeArea).toEqual({ datasetVersion: 'ds-2026', provinceCode: '79', communeCode: '26734' })
    expect(constraint).not.toHaveProperty('originLat')
    expect(constraint).not.toHaveProperty('radiusM')
  })

  it('keeps the user on the step when the chosen area comes from a replaced dataset', async () => {
    useRoomStore.getState().patchDraft({ administrativeArea: { ...AREA, datasetVersion: 'old' } })
    const view = await renderScreen(<CreateLocationScreen />)
    await press(view.getByText('Tiếp tục'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(view.getByText(/Dữ liệu hành chính đã thay đổi/)).toBeTruthy()
  })
})
