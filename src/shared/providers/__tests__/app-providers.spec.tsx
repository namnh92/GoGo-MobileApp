import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

import { AppProviders } from '../app-providers'

/**
 * GoGo-MobileApp#256 — the app start wires one push click listener, then push
 * identity, once the push SDK reports ready. The listener goes first so the tap
 * that launched the app does not wait on a login round trip, and a listener that
 * cannot register must not cost identity.
 *
 * Only the native edges are faked: the OneSignal module, the SDK start, identity,
 * the attribution SDK, the persisted query client and the session. The click
 * bootstrap and the startup retry are the shipped code.
 */

const mockAddListener = jest.fn()
const mockRemoveListener = jest.fn()
jest.mock('react-native-onesignal', () => ({
  OneSignal: {
    Notifications: {
      addEventListener: (...args: unknown[]) => mockAddListener(...args),
      removeEventListener: (...args: unknown[]) => mockRemoveListener(...args),
    },
  },
}))

const mockPushStartup = { result: 'ready' }
jest.mock('@/shared/notifications/bootstrap', () => ({
  initializePushSdk: async () => mockPushStartup.result,
}))

const mockStopIdentity = jest.fn()
const mockInitializeIdentity = jest.fn()
jest.mock('@/shared/notifications/identity-bootstrap', () => ({
  initializePushIdentity: () => mockInitializeIdentity(),
}))

jest.mock('@/shared/acquisition/bootstrap', () => ({ initializeAcquisitionSdk: () => undefined }))

jest.mock('@/shared/providers/session-provider', () => ({
  SessionProvider: ({ children }: { children: unknown }) => children,
}))

jest.mock('@/shared/api/query-client', () => {
  const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    createQueryClient: () => new QueryClient(),
    bindAppStateToQueryClient: () => () => {},
    queryPersister: {},
    shouldPersistQuery: () => false,
  }
})

jest.mock('@tanstack/react-query-persist-client', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { QueryClientProvider } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    PersistQueryClientProvider: ({ client, children }: { client: never; children: never }) =>
      React.createElement(QueryClientProvider, { client }, children),
  }
})

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual<typeof import('react-native')>('react-native').View,
}))

const clickListeners = (mock: jest.Mock) => mock.mock.calls.filter(([event]) => event === 'click')

beforeEach(() => {
  mockAddListener.mockReset()
  mockRemoveListener.mockReset()
  mockStopIdentity.mockReset()
  mockInitializeIdentity.mockReset()
  mockInitializeIdentity.mockReturnValue(mockStopIdentity)
  mockPushStartup.result = 'ready'
})

describe('AppProviders push start', () => {
  it('adds exactly one click listener, then starts identity, and removes both on unmount', async () => {
    const view = await render(
      <AppProviders>
        <Text>app</Text>
      </AppProviders>,
    )

    await waitFor(() => expect(mockInitializeIdentity).toHaveBeenCalledTimes(1))
    expect(clickListeners(mockAddListener)).toHaveLength(1)
    expect(mockAddListener.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitializeIdentity.mock.invocationCallOrder[0]!,
    )

    await view.unmount()
    expect(clickListeners(mockRemoveListener)).toHaveLength(1)
    expect(clickListeners(mockRemoveListener)[0]![1]).toBe(clickListeners(mockAddListener)[0]![1])
    expect(mockStopIdentity).toHaveBeenCalledTimes(1)
  })

  it('still starts identity when the click listener cannot be registered', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockAddListener.mockImplementation(() => {
      throw new Error('native module missing')
    })

    await render(
      <AppProviders>
        <Text>app</Text>
      </AppProviders>,
    )

    await waitFor(() => expect(mockInitializeIdentity).toHaveBeenCalledTimes(1))
    expect(warn).toHaveBeenCalledWith('push_click_listener_unavailable')
    warn.mockRestore()
  })

  it('starts neither when the build carries no push configuration', async () => {
    mockPushStartup.result = 'unconfigured'

    await render(
      <AppProviders>
        <Text>app</Text>
      </AppProviders>,
    )

    await waitFor(() => expect(mockAddListener).not.toHaveBeenCalled())
    expect(mockInitializeIdentity).not.toHaveBeenCalled()
  })
})
