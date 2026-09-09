import { fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * APP-005: the location permission is asked in context and every refusal leaves
 * a way forward. This drives the three outcomes a user can actually hit —
 * granted, denied, and a binary without the native module — and asserts the
 * screen says something true in each.
 */

const mockPermission = { status: 'granted' as string }
const mockModuleMissing = { value: false }

jest.mock('expo-router', () => ({
  // A screen under test is the one on top; the focus effect is a no-op.
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: async () => {
    // An old dev-client binary has the JS but not the native side, and throws
    // on the first call rather than on import.
    if (mockModuleMissing.value) throw new Error('native module not in this binary')
    return { status: mockPermission.status, canAskAgain: true }
  },
  getCurrentPositionAsync: async () => ({ coords: { latitude: 10.8, longitude: 106.7 } }),
  reverseGeocodeAsync: async () => [{ district: 'Thảo Điền', city: 'TP.HCM' }],
  Accuracy: { Balanced: 3 },
}))

// The location step reads the profile's home area as a default (ADR-0022);
// an anonymous session has none, and the session provider would otherwise pull
// the OneSignal native module into a renderer that has no native side.
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'anonymous' }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: undefined, isPending: false, isError: false }),
  useServiceAreas: () => ({ data: undefined, isPending: false, isError: false }),
  useAreaAutocomplete: () => ({
    data: { predictions: [], attribution: '' },
    isPending: false,
    isError: false,
    endSession: jest.fn(),
  }),
}))

import CreateLocationScreen from '@/features/create-date/create-location.view'

const PROMPT = /Chạm để dùng vị trí của bạn/
const DENIED = /Chưa có quyền vị trí/
const UNAVAILABLE = /Chưa lấy được vị trí/

beforeEach(() => {
  mockPermission.status = 'granted'
  mockModuleMissing.value = false
})

describe('location permission', () => {
  it('asks nothing on launch — the row invites a tap instead', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.queryAllByText(PROMPT).length).toBeGreaterThan(0)
    expect(view.queryAllByText(DENIED)).toHaveLength(0)
    expect(view.queryAllByText(UNAVAILABLE)).toHaveLength(0)
  })

  it('shows the resolved area once the user grants it', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    fireEvent.press(view.getByText(PROMPT))
    expect((await view.findAllByText(/Thảo Điền, TP\.HCM/)).length).toBeGreaterThan(0)
  })

  it('explains the fallback when the user denies it', async () => {
    mockPermission.status = 'denied'
    const view = await renderScreen(<CreateLocationScreen />)
    fireEvent.press(view.getByText(PROMPT))
    expect((await view.findAllByText(DENIED)).length).toBeGreaterThan(0)
  })

  // A native side that is present but fails at call time; the import-time
  // failure has its own file, since the mock cannot be swapped per test.
  it('degrades to the picker when the location call itself fails', async () => {
    mockModuleMissing.value = true
    const view = await renderScreen(<CreateLocationScreen />)
    fireEvent.press(view.getByText(PROMPT))
    expect((await view.findAllByText(UNAVAILABLE)).length).toBeGreaterThan(0)
  })
})
