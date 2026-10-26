import { act, render, screen } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'

import { TOAST_DURATION_MS, ToastProvider, useToast } from '@/shared/ui/toast.view'

/** GoGo-MobileApp#381 — one queue and one duration for every toast. */

const api: { show: ReturnType<typeof useToast>['show'] } = { show: () => {} }
const show = (message: string, options?: { duration?: number }) => api.show(message, options)
function Capture() {
  const toast = useToast()
  useEffect(() => {
    api.show = toast.show
  }, [toast])
  return <Text>màn hình</Text>
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('shows toasts one at a time, each for its full duration', async () => {
  await render(<ToastProvider><Capture /></ToastProvider>)
  await act(async () => {
    show('Một')
    show('Hai', { duration: 1000 })
  })
  expect(screen.getByText('Một')).toBeTruthy()
  expect(screen.queryByText('Hai')).toBeNull()
  await act(async () => { jest.advanceTimersByTime(TOAST_DURATION_MS) })
  expect(screen.queryByText('Một')).toBeNull()
  expect(screen.getByText('Hai')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(screen.queryByText('Hai')).toBeNull()
  expect(screen.getByText('màn hình')).toBeTruthy()
})

it('does not queue the same message twice in a row', async () => {
  await render(<ToastProvider><Capture /></ToastProvider>)
  await act(async () => {
    show('Một')
    show('Một')
  })
  await act(async () => { jest.advanceTimersByTime(TOAST_DURATION_MS) })
  expect(screen.queryByText('Một')).toBeNull()
})

it('fails loudly without a provider', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  await expect(render(<Capture />)).rejects.toThrow(/ToastProvider/)
  error.mockRestore()
})
