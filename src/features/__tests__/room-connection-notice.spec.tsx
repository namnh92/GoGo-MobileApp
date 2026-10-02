import { act, fireEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { AccessibilityInfo, AppState } from 'react-native'

import { renderScreen } from './harness'

import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'
import type { RoomRealtimeStatus } from '@/shared/api'
import { CONNECTING_NOTICE_DELAY_MS, RoomConnectionNotice } from '@/shared/ui/room-connection-notice.view'

/**
 * GoGo-MobileApp#292 — the one freshness notice a room screen carries:
 * offline → failed refresh → polling → connecting (after a delay) → nothing.
 */

const POLLING = 'Phòng cập nhật định kỳ; thay đổi có thể hiển thị chậm.'
const CONNECTING = 'Đang kết nối cập nhật phòng…'
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'

// jest-expo stubs `AppState.currentState` as a function; the app reads a string.
Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true })

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
const announceQueued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')

/** Captures the AppState listener so a test can background the app. */
let appStateListener: ((state: string) => void) | undefined
jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
  appStateListener = listener
  return { remove: () => undefined }
}) as never)

async function setAppState(state: 'active' | 'background') {
  await act(async () => {
    Object.defineProperty(AppState, 'currentState', { value: state, configurable: true, writable: true })
    appStateListener?.(state)
  })
}

async function elapse(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const notice = (status: RoomRealtimeStatus, props: Partial<Parameters<typeof RoomConnectionNotice>[0]> = {}) => (
  <RoomConnectionNotice roomId="room-a" status={status} {...props} />
)

beforeEach(() => {
  jest.useFakeTimers()
  announce.mockClear()
  announceQueued.mockClear()
  appStateListener = undefined
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true })
})

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
  jest.useRealTimers()
})

describe('polling', () => {
  it('shows at once and goes the moment the stream is live', async () => {
    const view = await renderScreen(notice('polling'))
    expect(view.getByText(POLLING)).toBeTruthy()
    // No control: reconnecting is the transport's job.
    expect(view.queryByRole('button')).toBeNull()

    await view.rerender(notice('live'))
    expect(view.queryByText(POLLING)).toBeNull()
    expect(view.toJSON()).toBeNull()
  })
})

describe('connecting', () => {
  it('stays hidden for a normal handshake and shows once it has lasted', async () => {
    const view = await renderScreen(notice('connecting'))
    await elapse(CONNECTING_NOTICE_DELAY_MS - 1)
    expect(view.queryByText(CONNECTING)).toBeNull()
    await elapse(1)
    expect(view.getByText(CONNECTING)).toBeTruthy()
  })

  it('restarts the delay after any interruption, so short episodes never add up', async () => {
    const view = await renderScreen(notice('connecting'))
    await elapse(1000)
    await view.rerender(notice('polling'))
    await view.rerender(notice('connecting'))
    await elapse(1000)
    expect(view.queryByText(CONNECTING)).toBeNull()

    // Another room is another handshake.
    await view.rerender(notice('connecting', { roomId: 'room-b' }))
    await elapse(CONNECTING_NOTICE_DELAY_MS - 1)
    expect(view.queryByText(CONNECTING)).toBeNull()
    await elapse(1)
    expect(view.getByText(CONNECTING)).toBeTruthy()
  })

  it('clears at once on live', async () => {
    const view = await renderScreen(notice('connecting'))
    await elapse(CONNECTING_NOTICE_DELAY_MS)
    await view.rerender(notice('live'))
    expect(view.toJSON()).toBeNull()
  })

  it('resets while the app is in the background', async () => {
    const view = await renderScreen(notice('connecting'))
    await elapse(1000)
    await setAppState('background')
    await elapse(CONNECTING_NOTICE_DELAY_MS)
    expect(view.queryByText(CONNECTING)).toBeNull()
    await setAppState('active')
    await elapse(CONNECTING_NOTICE_DELAY_MS - 1)
    expect(view.queryByText(CONNECTING)).toBeNull()
    await elapse(1)
    expect(view.getByText(CONNECTING)).toBeTruthy()
  })
})

describe('priority', () => {
  it('offline wins over polling, after only its own delay', async () => {
    const view = await renderScreen(notice('polling'))
    await act(async () => {
      onlineManager.setOnline(false)
    })
    // The hook reports `offline` the moment the device drops; during the
    // offline debounce neither notice speaks.
    await view.rerender(notice('offline'))
    expect(view.queryByText(POLLING)).toBeNull()
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.getAllByText(OFFLINE)).toHaveLength(1)
  })

  it('a failed refresh of cached data wins over polling and keeps its retry online', async () => {
    const retry = jest.fn()
    const view = await renderScreen(notice('polling', { error: new Error('500'), onRetry: retry }))
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.queryByText(POLLING)).toBeNull()
    await act(async () => {
      await fireEvent.press(view.getByText('Thử lại'))
    })
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('with nothing cached, leaves offline to the screen and still reports polling', async () => {
    const view = await renderScreen(notice('polling', { hasData: false }))
    expect(view.getByText(POLLING)).toBeTruthy()
  })

  it('says nothing for a screen that is not subscribed', async () => {
    const view = await renderScreen(notice('offline'))
    await elapse(CONNECTING_NOTICE_DELAY_MS)
    expect(view.toJSON()).toBeNull()
  })
})

describe('announcing', () => {
  it('announces each realtime notice once, queued, and not again on rerender', async () => {
    const view = await renderScreen(notice('polling'))
    expect(announceQueued).toHaveBeenCalledTimes(1)
    expect(announceQueued).toHaveBeenCalledWith(POLLING, { queue: true })

    await view.rerender(notice('polling', { onRetry: jest.fn() }))
    expect(announceQueued).toHaveBeenCalledTimes(1)

    await view.rerender(notice('connecting'))
    await elapse(CONNECTING_NOTICE_DELAY_MS - 1)
    expect(announceQueued).toHaveBeenCalledTimes(1)
    await elapse(1)
    expect(announceQueued).toHaveBeenCalledTimes(2)
    expect(announceQueued).toHaveBeenLastCalledWith(CONNECTING, { queue: true })

    // Recovery is silent.
    await view.rerender(notice('live'))
    expect(announceQueued).toHaveBeenCalledTimes(2)
    expect(announce).not.toHaveBeenCalled()
  })

  it('says nothing while backgrounded', async () => {
    const view = await renderScreen(notice('live'))
    await setAppState('background')
    await view.rerender(notice('polling'))
    expect(view.queryByText(POLLING)).toBeNull()
    expect(announceQueued).not.toHaveBeenCalled()
  })

  // #327 F-03: an offline spell that starts out of sight is announced when the
  // notice is seen, not into the background.
  it('does not announce offline while backgrounded, and announces it on return', async () => {
    const view = await renderScreen(notice('live'))
    await setAppState('background')
    await act(async () => {
      onlineManager.setOnline(false)
    })
    await view.rerender(notice('offline'))
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(announce).not.toHaveBeenCalled()

    await setAppState('active')
    expect(view.getByText(OFFLINE)).toBeTruthy()
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(OFFLINE)
  })

  it('does not announce offline from a screen that is not on top', async () => {
    const view = await renderScreen(notice('live', { visible: false }))
    await act(async () => {
      onlineManager.setOnline(false)
    })
    await view.rerender(notice('offline', { visible: false }))
    await elapse(OFFLINE_SIGNAL_DELAY_MS)
    expect(view.queryByText(OFFLINE)).toBeNull()
    expect(announce).not.toHaveBeenCalled()
  })
})
