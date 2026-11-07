import { act, renderHook, waitFor } from '@testing-library/react-native'
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from '@/shared/api/client'
import { useAdministrativeVersion } from './queries'

jest.mock('@/shared/api/client', () => ({ api: { get: jest.fn() } }))

it('observes the startup version across remount/focus/reconnect after five minutes, with explicit retry', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['administrative', 'version'], { datasetVersion: 'v1' })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const clock = jest.spyOn(Date, 'now')
  const now = Date.now()
  const get = jest.mocked(api.get).mockResolvedValue({ datasetVersion: 'v2' })
  try {
    const first = await renderHook(useAdministrativeVersion, { wrapper })
    expect(first.result.current.data?.datasetVersion).toBe('v1')
    await first.unmount()
    clock.mockReturnValue(now + 6 * 60_000)
    const second = await renderHook(useAdministrativeVersion, { wrapper })
    expect(second.result.current.data?.datasetVersion).toBe('v1')
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    expect(get).not.toHaveBeenCalled()
    await act(async () => { await second.result.current.refetch() })
    expect(get).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(second.result.current.data?.datasetVersion).toBe('v2'))
    await second.unmount()
  } finally {
    clock.mockRestore()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
    client.clear()
  }
})
