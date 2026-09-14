import { fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * Regression: `expo-location` throws "Cannot find native module 'ExpoLocation'"
 * at *import* time on a dev-client binary built before the module was added.
 * A static import therefore took the whole create-location screen down — seen
 * on a simulator, not in theory. The module is loaded lazily inside a
 * try/catch, and this asserts the screen survives and offers the area picker.
 *
 * It lives in its own file because the failure has to happen at require time,
 * which means the module mock cannot be swapped per test.
 */

jest.mock('expo-location', () => {
  throw new Error("Cannot find native module 'ExpoLocation'")
})

jest.mock('expo-router', () => ({
  // A screen under test is the one on top; the focus effect is a no-op.
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
}))

// ADM-202: the area choice is the shared administrative picker; its queries
// need a QueryClient the harness does not provide.
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: 'ds' }, isPending: false, isError: false, error: null, refetch: jest.fn() }),
  useAdministrativeUnits: () => ({ data: [], isPending: false, isError: false, error: null, refetch: jest.fn() }),
}))

import CreateLocationScreen from '@/features/create-date/create-location.view'

describe('create location without the native location module', () => {
  it('still renders instead of crashing on import', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.toJSON()).not.toBeNull()
  })

  it('says the location is unavailable and leaves the area picker', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    fireEvent.press(view.getByText(/Chạm để dùng vị trí của bạn/))
    expect((await view.findAllByText(/Chưa lấy được vị trí/)).length).toBeGreaterThan(0)
  })
})
