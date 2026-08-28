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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useAreaAutocomplete: () => ({
    data: { predictions: [], attribution: '' },
    isPending: false,
    isError: false,
    endSession: jest.fn(),
  }),
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
