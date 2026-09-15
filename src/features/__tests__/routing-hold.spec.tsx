import { act, renderHook } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'

import type { AppActivity } from '@/shared/api/realtime/app-activity'
import { alertWithHold, releaseOnReturn, useRoutingHold } from '@/shared/navigation/routing-hold'

/**
 * GoGo-MobileApp#198 review — the lobby moves people on by itself, never out
 * from under a sheet or a confirmation. Holds used to be one boolean, so two
 * overlapping ones cleared each other, and Android's share call resolves while
 * its chooser is still up.
 */

function fakeActivity(initiallyActive = true) {
  let active = initiallyActive
  const listeners = new Set<(active: boolean) => void>()
  const activity: AppActivity = {
    isActive: () => active,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const set = (next: boolean) => {
    active = next
    listeners.forEach(listener => listener(next))
  }
  return { activity, set, listeners }
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('useRoutingHold', () => {
  it('stays held until every hold is released, and a release counts once', async () => {
    const { result } = await renderHook(() => useRoutingHold())
    let sheet!: () => void
    let dialog!: () => void

    await act(async () => {
      sheet = result.current.hold()
      dialog = result.current.hold()
    })
    expect(result.current.held).toBe(true)

    await act(async () => {
      sheet()
      sheet()
    })
    expect(result.current.held).toBe(true)

    await act(async () => dialog())
    expect(result.current.held).toBe(false)
  })
})

describe('alertWithHold', () => {
  it('holds while the alert is up, then releases and runs the button pressed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const { result } = await renderHook(() => useRoutingHold())
    const onContinue = jest.fn()

    await act(async () => {
      alertWithHold(result.current.hold, 'Title', 'Body', [{ text: 'Huỷ', style: 'cancel' }, { text: 'Tiếp', onPress: onContinue }])
    })
    expect(result.current.held).toBe(true)

    const buttons = alert.mock.calls[0][2] as AlertButton[]
    await act(async () => buttons[1].onPress?.())
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(result.current.held).toBe(false)
  })

  it('releases when Android dismisses the alert without a button', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    const { result } = await renderHook(() => useRoutingHold())

    await act(async () => {
      alertWithHold(result.current.hold, 'Title', undefined, [{ text: 'OK' }])
    })
    await act(async () => (alert.mock.calls[0][3] as { onDismiss?: () => void }).onDismiss?.())

    expect(result.current.held).toBe(false)
  })
})

describe('releaseOnReturn', () => {
  it('waits for the app to leave for the chooser and come back', () => {
    jest.useFakeTimers()
    const { activity, set, listeners } = fakeActivity()
    const release = jest.fn()

    releaseOnReturn(release, { activity, graceMs: 1_000 })
    set(false)
    jest.advanceTimersByTime(5_000)
    expect(release).not.toHaveBeenCalled()

    set(true)
    expect(release).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
  })

  it('releases after a short grace when the app never left', () => {
    jest.useFakeTimers()
    const { activity, listeners } = fakeActivity()
    const release = jest.fn()

    releaseOnReturn(release, { activity, graceMs: 1_000 })
    jest.advanceTimersByTime(999)
    expect(release).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)

    expect(release).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
  })
})
