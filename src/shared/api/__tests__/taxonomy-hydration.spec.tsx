import { act, render, waitFor } from '@testing-library/react-native'
import { dehydrate, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider, type PersistedClient, type Persister } from '@tanstack/react-query-persist-client'
import { Text } from 'react-native'

import { useTaxonomies } from '../queries/use-preferences'
import { queryKeys } from '../query-keys'
import { shouldPersistQuery } from '../persist-policy'

const mockConditionalGet = jest.fn()
jest.mock('../client', () => ({ conditionalGet: (...args: unknown[]) => mockConditionalGet(...args) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'vi' } }) }))

function Consumer({ kinds }: { kinds?: string }) {
  const query = useTaxonomies(kinds ? { kinds } : undefined)
  return <Text>{query.data?.kinds?.mood?.[0]?.labels?.vi ?? 'loading'}</Text>
}

it('waits for disk hydration, shows cache while validating, and shares launch validation across consumers', async () => {
  const previous = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  previous.setQueryData(queryKeys.taxonomies('vi'), {
    data: { version: 1, kinds: { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] } }, etag: 'W/"vi-1"',
  })
  const saved: PersistedClient = { timestamp: Date.now(), buster: '', clientState: dehydrate(previous, {
    shouldDehydrateQuery: query => shouldPersistQuery(query.queryKey),
  }) }
  previous.clear()
  let restore!: (value: PersistedClient) => void
  let validated!: (value: unknown) => void
  const disk = new Promise<PersistedClient>(resolve => { restore = resolve })
  mockConditionalGet.mockReturnValue(new Promise(resolve => { validated = resolve }))
  const persister: Persister = { persistClient: () => {}, restoreClient: () => disk, removeClient: () => {} }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  const view = await render(
    <PersistQueryClientProvider client={client} persistOptions={{ persister }}>
      <Consumer /><Consumer kinds="mood" />
    </PersistQueryClientProvider>,
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
  client.clear()
})
