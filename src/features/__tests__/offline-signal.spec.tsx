import { act, fireEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { AccessibilityInfo } from 'react-native'

import { renderScreen } from './harness'

import { NetworkError } from '@/shared/api/errors'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
import { OfflineState, StaleNotice } from '@/shared/ui/async-state.view'

/**
 * GoGo-MobileApp#253 (regression #218, Samsung in airplane mode): Plans and the
 * room kept rendering cached data with nothing saying it might be old. The
 * notice waited for an error, and offline TanStack Query pauses a refetch
 * instead of failing it.
 */
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'
const RETRY = 'Thử lại'

async function goOffline() {
  await act(async () => {
    onlineManager.setOnline(false)
  })
}

async function goOnline() {
  await act(async () => {
    onlineManager.setOnline(true)
  })
}

async function elapse(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')

beforeEach(() => {
  jest.useFakeTimers()
  announce.mockClear()
})

afterEach(async () => {
  await goOnline()
  jest.useRealTimers()
})

describe('cached data × connectivity', () => {
  it('says the data is the saved copy once offline has lasted, with no error at all', async () => {
    await goOffline()
    const view = await renderScreen(<StaleNotice error={null} onRetry={jest.fn()} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS - 1)
    expect(view.queryByText(OFFLINE)).toBeNull()

    await elapse(1)
    expect(view.getByText(OFFLINE)).toBeTruthy()
    // Offline a retry would only pause again: no control that does nothing.
    expect(view.queryByText(RETRY)).toBeNull()
  })

  it('does not flash on a Wi-Fi↔cellular handover', async () => {
    const view = await renderScreen(<StaleNotice error={null} />)
    await goOffline()
    await elapse(1000)
    await goOnline()
    await goOffline()
    await elapse(1000)
    // Two short drops never add up: the delay restarts with each one.
    expect(view.queryByText(OFFLINE)).toBeNull()

    await elapse(OFFLINE_SIGNAL_DELAY_MS - 1000)
    expect(view.getByText(OFFLINE)).toBeTruthy()
  })

  it('goes away the moment the connection comes back', async () => {
    await goOffline()
    const view = await renderScreen(<StaleNotice error={null} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.getByText(OFFLINE)).toBeTruthy()

    await goOnline()
    expect(view.queryByText(OFFLINE)).toBeNull()
  })

  it('shows nothing for fresh data online', async () => {
    const view = await renderScreen(<StaleNotice error={null} onRetry={jest.fn()} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
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
    await goOffline()
    const view = await renderScreen(<StaleNotice error={null} hasData={false} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.toJSON()).toBeNull()
  })
})

describe('a section inside a screen that has its own bar', () => {
  it('stays silent offline, so the screen shows one bar', async () => {
    await goOffline()
    const view = await renderScreen(<StaleNotice error={null} reportOffline={false} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.toJSON()).toBeNull()
  })

  it('leaves a transport failure to the screen while the device is offline', async () => {
    await goOffline()
    const view = await renderScreen(<StaleNotice error={new NetworkError()} reportOffline={false} />)
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.toJSON()).toBeNull()
  })

  // Codex review of 443c7b3: online, the screen's bar is down, so a section that
  // hid its own timeout left cached content with no warning and no Retry.
  it('reports its own transport failure while the device is online, with a retry', async () => {
    const view = await renderScreen(<StaleNotice error={new NetworkError()} reportOffline={false} onRetry={jest.fn()} />)
    expect(view.getByText(OFFLINE)).toBeTruthy()
    expect(view.getByText(RETRY)).toBeTruthy()
  })

  it('still reports its own failed refresh, with a retry', async () => {
    const view = await renderScreen(<StaleNotice error={new Error('500')} reportOffline={false} onRetry={jest.fn()} />)
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.getByText(RETRY)).toBeTruthy()
  })
})

describe('announcing offline', () => {
  it('announces once per offline spell, whatever renders or how many notices are mounted', async () => {
    const view = await renderScreen(
      <>
        <StaleNotice error={null} />
        <StaleNotice error={null} />
      </>,
    )
    await goOffline()
    await elapse(OFFLINE_SIGNAL_DELAY_MS - 1)
    expect(announce).not.toHaveBeenCalled()

    await elapse(1)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(OFFLINE)

    await view.rerender(
      <>
        <StaleNotice error={null} onRetry={jest.fn()} />
        <StaleNotice error={null} />
        <StaleNotice error={null} />
      </>,
    )
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(announce).toHaveBeenCalledTimes(1)

    // A new spell is a new transition.
    await goOnline()
    await goOffline()
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('does not announce a failed refresh or a short drop', async () => {
    await renderScreen(<StaleNotice error={new Error('500')} />)
    await goOffline()
    await elapse(OFFLINE_SIGNAL_DELAY_MS - 1)
    await goOnline()
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(announce).not.toHaveBeenCalled()
  })
})

describe('nothing cached × offline', () => {
  it('says there is no connection, offers no retry, and announces it', async () => {
    await goOffline()
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    const view = await renderScreen(<OfflineState />)
    expect(view.getByText('Không có kết nối')).toBeTruthy()
    expect(view.getByText('Bạn đang ngoại tuyến. Một số thông tin có thể chưa cập nhật.')).toBeTruthy()
    expect(view.queryByText(RETRY)).toBeNull()
    expect(announce).toHaveBeenCalledTimes(1)
  })
})
