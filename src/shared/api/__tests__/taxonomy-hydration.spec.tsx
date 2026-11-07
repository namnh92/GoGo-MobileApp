import { act, render, waitFor } from '@testing-library/react-native'
import { dehydrate, onlineManager, QueryClient, useQueryClient } from '@tanstack/react-query'
import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { Text } from 'react-native'

import { useTaxonomies } from '../queries/use-preferences'
import { queryKeys } from '../query-keys'
import { shouldPersistQuery } from '../persist-policy'
import { AppProviders } from '@/shared/providers/app-providers'

const mockConditionalGet = jest.fn()
jest.mock('../client', () => ({ conditionalGet: (...args: unknown[]) => mockConditionalGet(...args) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'vi' } }) }))

const mockRestoreClient = jest.fn()
const mockRemoveClient = jest.fn()
const mockClients: QueryClient[] = []
jest.mock('../query-client', () => ({
  createQueryClient: () => {
    const { QueryClient } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
    mockClients.push(client)
    return client
  },
  bindAppStateToQueryClient: () => () => {},
  queryPersister: {
    persistClient: () => {},
    restoreClient: () => mockRestoreClient(),
    removeClient: () => mockRemoveClient(),
  },
  shouldPersistQuery: (key: readonly unknown[]) =>
    jest.requireActual<typeof import('../persist-policy')>('../persist-policy').shouldPersistQuery(key),
}))
jest.mock('@/shared/providers/session-provider', () => ({ SessionProvider: ({ children }: { children: unknown }) => children }))
jest.mock('@/shared/acquisition/bootstrap', () => ({ initializeAcquisitionSdk: () => {} }))
jest.mock('@/shared/notifications/bootstrap', () => ({ initializePushSdk: async () => 'unconfigured' }))
jest.mock('@/shared/notifications/device-promotions-store', () => ({ devicePromotionsStore: { load: async () => {} } }))
jest.mock('@/shared/notifications/identity-bootstrap', () => ({ initializePushIdentity: jest.fn() }))
jest.mock('@/shared/notifications/notification-clicks-bootstrap', () => ({ startNotificationClicks: jest.fn() }))
jest.mock('@/shared/theme/use-accent-bootstrap', () => ({ useAccentBootstrap: () => true }))
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual<typeof import('react-native')>('react-native').View,
}))

afterEach(() => {
  mockClients.splice(0).forEach(client => client.clear())
  mockConditionalGet.mockReset()
  mockRestoreClient.mockReset()
  mockRemoveClient.mockReset()
  onlineManager.setOnline(true)
})

function Consumer({ kinds }: { kinds?: string }) {
  const query = useTaxonomies(kinds ? { kinds } : undefined)
  return <Text>{query.data?.kinds?.mood?.[0]?.labels?.vi ?? 'loading'}</Text>
}

it('waits for disk hydration, shows cache while validating, and shares launch validation across consumers', async () => {
  const previous = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  previous.setQueryData(queryKeys.taxonomies('vi'), {
    data: { version: 1, kinds: { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] } }, etag: 'W/"vi-1"',
  })
  const saved: PersistedClient = { timestamp: Date.now(), buster: 'gogo.v1.0.0-alpha.2', clientState: dehydrate(previous, {
    shouldDehydrateQuery: query => shouldPersistQuery(query.queryKey),
  }) }
  previous.clear()
  let restore!: (value: PersistedClient) => void
  let validated!: (value: unknown) => void
  const disk = new Promise<PersistedClient>(resolve => { restore = resolve })
  mockRestoreClient.mockReturnValue(disk)
  mockConditionalGet.mockReturnValue(new Promise(resolve => { validated = resolve }))
  const view = await render(
    <AppProviders>
      <Consumer /><Consumer kinds="mood" />
    </AppProviders>,
  )
  expect(mockConditionalGet).not.toHaveBeenCalled()
  await act(async () => restore(JSON.parse(JSON.stringify(saved))))
  await waitFor(() => expect(view.getAllByText('Ấm cúng')).toHaveLength(2))
  expect(mockConditionalGet).toHaveBeenCalledTimes(1)
  expect(mockConditionalGet).toHaveBeenCalledWith('/taxonomies', expect.objectContaining({
    query: { locale: 'vi' }, ifNoneMatch: 'W/"vi-1"',
  }))
  await act(async () => validated({ status: 304, etag: 'W/"vi-1"' }))
  await view.unmount()
})

function UserCacheConsumer() {
  const client = useQueryClient()
  useTaxonomies()
  return <Text>{client.getQueryData(queryKeys.me()) ? 'profile restored' : 'profile absent'}</Text>
}

it.each([
  { mode: 'offline', hours: 25 },
  { mode: 'online', hours: 25 },
  { mode: 'offline', hours: 1 },
] as const)('retains taxonomy and ETag after $hours hours $mode with the account expiry intact', async ({ mode, hours }) => {
  const previous = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  const snapshot = {
    data: { version: 1, kinds: { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] } }, etag: 'W/"vi-1"',
  }
  previous.setQueryData(queryKeys.taxonomies('vi'), snapshot)
  previous.setQueryData(queryKeys.taxonomyVersion('vi', 1), snapshot)
  previous.setQueryData(queryKeys.me(), { id: 'old-user' })
  const saved: PersistedClient = {
    timestamp: Date.now() - hours * 60 * 60 * 1000,
    buster: 'gogo.v1.0.0-alpha.2',
    clientState: dehydrate(previous, { shouldDehydrateQuery: query => shouldPersistQuery(query.queryKey) }),
  }
  previous.clear()
  mockRestoreClient.mockResolvedValue(JSON.parse(JSON.stringify(saved)))
  mockConditionalGet.mockResolvedValue({ status: 304, etag: 'W/"vi-1"' })
  onlineManager.setOnline(mode === 'online')
  const view = await render(<AppProviders><Consumer /><UserCacheConsumer /></AppProviders>)
  try {
    await waitFor(() => expect(view.getByText('Ấm cúng')).toBeTruthy())
    expect(view.getByText(hours > 24 ? 'profile absent' : 'profile restored')).toBeTruthy()
    expect(mockClients[0].getQueryData(queryKeys.me())).toEqual(hours > 24 ? undefined : { id: 'old-user' })
    expect(mockClients[0].getQueryData(queryKeys.taxonomyVersion('vi', 1))).toEqual(snapshot)
    expect(mockRemoveClient).not.toHaveBeenCalled()
    if (mode === 'offline') {
      expect(mockConditionalGet).not.toHaveBeenCalled()
    } else {
      expect(mockConditionalGet).toHaveBeenCalledTimes(1)
      expect(mockConditionalGet).toHaveBeenCalledWith('/taxonomies', expect.objectContaining({ ifNoneMatch: 'W/"vi-1"' }))
    }
  } finally {
    await view.unmount()
  }
})
