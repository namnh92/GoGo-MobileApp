import { act, fireEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'

import { renderScreen } from './harness'

import { NetworkError } from '@/shared/api/errors'
import { StaleNotice } from '@/shared/ui/async-state.view'

/**
 * GoGo-MobileApp#253 (regression #218, Samsung in airplane mode): Plans and the
 * room kept rendering cached data with nothing saying it might be old. The
 * notice waited for an error, and offline TanStack Query pauses a refetch
 * instead of failing it.
 */
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'
const RETRY = 'Thử lại'

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
})

describe('cached data × connectivity', () => {
  it('says the data is the saved copy while offline, with no error at all', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<StaleNotice error={null} onRetry={jest.fn()} />)
    expect(view.getByText(OFFLINE)).toBeTruthy()
    // Offline a retry would only pause again: no control that does nothing.
    expect(view.queryByText(RETRY)).toBeNull()
  })

  it('goes away when the connection comes back', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<StaleNotice error={null} />)
    expect(view.getByText(OFFLINE)).toBeTruthy()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(OFFLINE)).toBeNull()
  })

  it('shows nothing for fresh data online', async () => {
    const view = await renderScreen(<StaleNotice error={null} onRetry={jest.fn()} />)
    expect(view.toJSON()).toBeNull()
  })

  it('still reports a failed refresh while online, with a retry', async () => {
    const retry = jest.fn()
    const view = await renderScreen(<StaleNotice error={new Error('500')} onRetry={retry} />)
    expect(view.getByText(FAILED)).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByText(RETRY))
    })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('reads a transport failure as offline', async () => {
    const view = await renderScreen(<StaleNotice error={new NetworkError()} />)
    expect(view.getByText(OFFLINE)).toBeTruthy()
  })

  it('leaves the screen to speak when nothing is cached', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<StaleNotice error={null} hasData={false} />)
    expect(view.toJSON()).toBeNull()
  })
})
