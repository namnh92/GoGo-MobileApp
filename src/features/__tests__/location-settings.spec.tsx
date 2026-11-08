import { act, fireEvent, within } from '@testing-library/react-native'
import { AppState, Linking, type AppStateStatus } from 'react-native'

import { renderScreen } from './harness'

/**
 * PROF-APP-005 (#180) — the "Vị trí" row leads to the truth about this device's
 * permission and the way to change it. It asks nothing on its own, offers the
 * prompt only when it was never shown, sends to Settings when it was refused,
 * and stores nothing.
 */

const mockPermission = { status: 'granted' as string, granted: true }
const mockModuleMissing = { value: false }
const mockRequest = jest.fn()

const mockPush = jest.fn()
// Its own "Mở cài đặt" is another section's button (#370).
jest.mock('@/features/settings/device-promotions.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { DevicePromotionsSection: () => <Text>device-promotions-section</Text> }
})
jest.mock('@/features/settings/tracking-consent.view', () => ({ TrackingConsentSection: () => null }))
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/features/notifications/notification-switch.view', () => ({ NotificationSwitchSection: () => null }))

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => {
    if (mockModuleMissing.value) throw new Error('native module not in this binary')
    return { status: mockPermission.status, granted: mockPermission.granted, canAskAgain: true }
  },
  requestForegroundPermissionsAsync: async () => {
    mockRequest()
    mockPermission.status = 'granted'
    mockPermission.granted = true
    return { status: 'granted', granted: true, canAskAgain: true }
  },
}))

import LocationSettingsScreen from '@/features/settings/permissions.view'

function permission(status: string) {
  mockPermission.status = status
  mockPermission.granted = status === 'granted'
}

beforeEach(() => {
  permission('granted')
  mockModuleMissing.value = false
  mockRequest.mockClear()
  mockPush.mockClear()
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('location settings', () => {
  it('reports an allowed permission and asks for nothing', async () => {
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText('Đã cho phép.')).toBeTruthy()
    expect(mockRequest).not.toHaveBeenCalled()
    expect(view.queryByText('Cho phép')).toBeNull()
  })

  it('aligns the title with its icon independently of the status and keeps the inline action flush left', async () => {
    const view = await renderScreen(<LocationSettingsScreen />)
    await view.findByText('Đã cho phép.')
    const titleBox = view.getByTestId('location-permission-title')
    expect(titleBox).toHaveStyle({ minHeight: 40, justifyContent: 'center' })
    expect(within(titleBox).getByText('Quyền vị trí trên máy này')).toBeTruthy()
    expect(within(titleBox).queryByText('Đã cho phép.')).toBeNull()
    expect(view.getByRole('button', { name: 'Mở cài đặt' })).toHaveStyle({
      paddingHorizontal: 0, justifyContent: 'flex-start', minHeight: 48,
    })
  })

  it('offers the prompt only when it was never shown, and re-reads after it', async () => {
    permission('undetermined')
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Chưa hỏi/)).toBeTruthy()
    await act(async () => {
      await fireEvent.press(view.getByText('Cho phép'))
    })
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(await view.findByText('Đã cho phép.')).toBeTruthy()
  })

  it('sends a refused permission to Settings instead of asking again', async () => {
    permission('denied')
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Đang tắt trong cài đặt/)).toBeTruthy()
    expect(view.queryByText('Cho phép')).toBeNull()
    await fireEvent.press(view.getByText('Mở cài đặt'))
    expect(Linking.openSettings).toHaveBeenCalledTimes(1)
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('says so when the device cannot provide a location at all', async () => {
    mockModuleMissing.value = true
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Máy này chưa lấy được vị trí/)).toBeTruthy()
    expect(view.queryByText('Cho phép')).toBeNull()
    expect(view.queryByText('Mở cài đặt')).toBeNull()
  })

  it('re-reads the permission when the app returns from Settings', async () => {
    let resume: ((state: AppStateStatus) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      resume = callback
      return { remove: jest.fn() }
    })
    permission('denied')
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Đang tắt trong cài đặt/)).toBeTruthy()

    permission('granted')
    await act(async () => {
      resume?.('active')
    })
    expect(await view.findByText('Đã cho phép.')).toBeTruthy()
  })

  it('opens Defaults to choose the default area without requesting location', async () => {
    const view = await renderScreen(<LocationSettingsScreen />)
    await act(async () => {
      await fireEvent.press(view.getByText('Chọn khu vực trong cài đặt mặc định'))
    })
    expect(mockPush).toHaveBeenCalledWith('/settings/defaults')
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('explains that a profile keeps an area, never a position', async () => {
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(view.getByText(/không lưu vị trí/)).toBeTruthy()
  })
})
