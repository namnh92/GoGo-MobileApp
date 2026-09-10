import { act, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

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

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

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

import LocationSettingsScreen from '@/features/settings/location.view'

function permission(status: string) {
  mockPermission.status = status
  mockPermission.granted = status === 'granted'
}

beforeEach(() => {
  permission('granted')
  mockModuleMissing.value = false
  mockRequest.mockClear()
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

  it('offers the prompt only when it was never shown, and re-reads after it', async () => {
    permission('undetermined')
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Chưa hỏi/)).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByText('Cho phép'))
    })
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(await view.findByText('Đã cho phép.')).toBeTruthy()
  })

  it('sends a refused permission to Settings instead of asking again', async () => {
    permission('denied')
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Đang tắt trong Cài đặt/)).toBeTruthy()
    expect(view.queryByText('Cho phép')).toBeNull()
    fireEvent.press(view.getByText('Mở Cài đặt'))
    expect(Linking.openSettings).toHaveBeenCalledTimes(1)
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('says so when the device cannot provide a location at all', async () => {
    mockModuleMissing.value = true
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(await view.findByText(/Máy này chưa lấy được vị trí/)).toBeTruthy()
    expect(view.queryByText('Cho phép')).toBeNull()
    expect(view.queryByText('Mở Cài đặt')).toBeNull()
  })

  it('explains that a profile keeps an area, never a position', async () => {
    const view = await renderScreen(<LocationSettingsScreen />)
    expect(view.getByText(/không lưu vị trí/)).toBeTruthy()
  })
})
