import { act, fireEvent, render, screen } from '@testing-library/react-native'
import * as React from 'react'

/**
 * GoGo-MobileApp#398 (shape D6) — when the promotions disclosure appears: a device
 * with no account or a guest, at a real moment, while there is no answer on record,
 * also with the OS permission already granted; never over the tracking sheet.
 */

const mockState = { status: 'anonymous' as string, segments: ['(tabs)'] as string[], trackingOpen: false }
const mockTrackingListeners = new Set<() => void>()

jest.mock('expo-router', () => ({ useSegments: () => mockState.segments }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockState.status }) }))
jest.mock('@/shared/hooks/use-app-foreground', () => ({ useAppForeground: () => true }))
jest.mock('@/shared/consent/tracking-consent-gate', () => ({
  isTrackingQuestionOpen: () => mockState.trackingOpen,
  subscribeTrackingQuestion: (listener: () => void) => {
    mockTrackingListeners.add(listener)
    return () => mockTrackingListeners.delete(listener)
  },
}))
jest.mock('../identity-bootstrap', () => ({ pushIdentity: {} }))
jest.mock('../permission-bootstrap', () => ({ pushPermission: {} }))
jest.mock('@/shared/ui/feedback', () => ({
  ...jest.requireActual('@/shared/ui/feedback'),
  haptic: jest.fn(),
}))

import i18n from '@/shared/i18n'
import { haptic } from '@/shared/ui/feedback'
import { markSplashHidden } from '@/shared/ui/splash-state'

import { DevicePromotionsGate, resetDevicePromotionsLaunch } from '../device-promotions-gate'
import { createDevicePromotionsStore, type DevicePromotionsStore } from '../device-promotions-store'

function storeWith(raw: string | null) {
  return createDevicePromotionsStore({
    storage: { getItem: async () => raw, setItem: async () => undefined },
  })
}

function actions(store = storeWith(null), transition = async () => {}) {
  const order: string[] = []
  return {
    order,
    actions: {
      requestPermission: jest.fn(async () => {
        order.push('permission')
      }),
      answer: jest.fn(async (answer: 'accepted' | 'declined') => {
        order.push(answer)
        await Promise.all([store.answer(answer), transition()])
      }),
    },
  }
}

async function mount(raw: string | null = null) {
  const store = storeWith(raw)
  const made = actions(store)
  const view = await render(<DevicePromotionsGate store={store} actions={made.actions} />)
  await act(async () => {})
  return { ...made, store, view }
}

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

async function mountWithWrite(write: () => Promise<void>, transition = async () => {}) {
  const setItem = jest.fn<Promise<void>, [string, string]>(async () => {})
  const store: DevicePromotionsStore = createDevicePromotionsStore({
    storage: { getItem: async () => null, setItem },
  })
  const made = actions(store, transition)
  const view = await render(<DevicePromotionsGate store={store} actions={made.actions} />)
  await act(async () => {})
  // Preparation is durable; control only the answer's write.
  setItem.mockImplementation(write)
  return { ...made, store, view, setItem }
}

beforeAll(async () => {
  await i18n.changeLanguage('vi')
  markSplashHidden()
})

beforeEach(() => {
  mockState.status = 'anonymous'
  mockState.segments = ['(tabs)']
  mockState.trackingOpen = false
  resetDevicePromotionsLaunch()
  jest.mocked(haptic).mockClear()
})

const TITLE = 'Nhận ưu đãi từ GoGo?'

describe('when it asks', () => {
  it('family 3: a nullable envelope still shows the sheet without an initialized SDK', async () => {
    await mount(JSON.stringify({ envelopeVersion: 1, disclosure: null, retirementOwed: true, enabled: true, version: 0, pendingVersion: null, awaitingProviderOff: false }))
    expect(screen.getByText(TITLE)).toBeTruthy()
  })

  it('family 8: the sheet waits for durable preparation, not SDK initialization', async () => {
    let finish!: () => void
    const store = createDevicePromotionsStore({ storage: {
      getItem: async () => null,
      setItem: () => new Promise<void>(resolve => { finish = resolve }),
    } })
    await render(<DevicePromotionsGate store={store} actions={actions(store).actions} />)
    await act(async () => {})
    expect(screen.queryByText(TITLE)).toBeNull()
    await act(async () => { finish() })
    expect(screen.getByText(TITLE)).toBeTruthy()
  })
  it('asks a device with no answer on record', async () => {
    await mount()
    expect(screen.getByText(TITLE)).toBeTruthy()
  })

  it('asks a guest too', async () => {
    mockState.status = 'guest'
    await mount()
    expect(screen.getByText(TITLE)).toBeTruthy()
  })

  it('never asks someone signed in', async () => {
    mockState.status = 'user'
    await mount()
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it('not on the sign-in or onboarding screens', async () => {
    mockState.segments = ['auth', 'sign-in']
    await mount()
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it('waits for the tracking sheet: iOS drops a second modal', async () => {
    mockState.trackingOpen = true
    await mount()
    expect(screen.queryByText(TITLE)).toBeNull()

    mockState.trackingOpen = false
    await act(async () => {
      for (const listener of mockTrackingListeners) listener()
    })
    expect(screen.getByText(TITLE)).toBeTruthy()
  })

  it('does not ask again once answered', async () => {
    const record = JSON.stringify({
      disclosure: { id: 'device-promotions-v1', answer: 'declined', at: '2026-11-04T00:00:00.000Z' },
      enabled: false,
      version: 1,
      pendingVersion: null,
      awaitingProviderOff: false,
    })
    await mount(record)
    expect(screen.queryByText(TITLE)).toBeNull()
  })

  it('a disk it could not read is not "no answer"', async () => {
    const store = createDevicePromotionsStore({
      storage: { getItem: async () => { throw new Error('disk') }, setItem: async () => undefined },
    })
    await render(<DevicePromotionsGate store={store} actions={actions(store).actions} />)
    await act(async () => {})
    expect(screen.queryByText(TITLE)).toBeNull()
  })
})

describe('what the answers do', () => {
  it('keeps the sheet open and button busy while the answer save is pending', async () => {
    const write = deferred()
    const { actions: calls, store } = await mountWithWrite(() => write.promise)

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })

    expect(calls.answer).toHaveBeenCalledWith('accepted')
    // The optimistic snapshot alone is not proof of a durable answer.
    expect(store.snapshot()).toMatchObject({ read: 'loaded', answer: 'accepted', save: 'saving' })
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toEqual({ disabled: true, busy: true })
    expect(haptic).not.toHaveBeenCalledWith('select')

    await act(async () => { write.resolve() })
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(haptic).toHaveBeenCalledWith('select')
  })

  it('closes after the answer is saved even when the identity transition never settles', async () => {
    const transition = deferred()
    const { actions: calls, store } = await mountWithWrite(async () => {}, () => transition.promise)

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })

    expect(calls.answer).toHaveBeenCalledWith('accepted')
    expect(store.snapshot().save).toBe('saved')
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(jest.mocked(haptic).mock.calls.filter(([kind]) => kind === 'select')).toHaveLength(1)
  })

  it('keeps the sheet open and the button busy while permission is pending', async () => {
    const { actions: calls } = await mount()
    let finishPermission!: () => void
    calls.requestPermission.mockImplementationOnce(() => new Promise<void>(resolve => { finishPermission = resolve }))

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toEqual({ disabled: true, busy: true })
    expect(calls.answer).not.toHaveBeenCalled()
    expect(haptic).not.toHaveBeenCalledWith('select')

    await act(async () => { finishPermission() })
    expect(calls.answer).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(screen.queryByTestId('button-spinner', { includeHiddenElements: true })).toBeNull()
  })

  it('does not flash back while the store still reports absent', async () => {
    const { actions: calls, store, view, setItem } = await mountWithWrite(async () => {})
    const absent = store.snapshot()
    setItem.mockClear()
    // A stale subscriber must not reopen a locally completed answer.
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(store.snapshot()).toMatchObject({ answer: 'accepted', save: 'saved' })
    expect(JSON.parse(setItem.mock.calls[0][1]).disclosure.answer).toBe('accepted')
    expect(screen.queryByText(TITLE)).toBeNull()

    const snapshot = jest.spyOn(store, 'snapshot').mockReturnValue(absent)
    try {
      await act(async () => { store.setServiceOff(true) })
      await view.rerender(<DevicePromotionsGate store={store} actions={calls} />)
      expect(store.snapshot().read).toBe('absent')
      expect(screen.queryByText(TITLE)).toBeNull()
      expect(calls.answer).toHaveBeenCalledTimes(1)
    } finally {
      snapshot.mockRestore()
    }
  })

  it('handles a background answer rejection without reopening or another commit haptic', async () => {
    const transition = deferred()
    const { store, view, actions: calls } = await mountWithWrite(async () => {}, () => transition.promise)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(store.snapshot().save).toBe('saved')
    expect(screen.queryByText(TITLE)).toBeNull()

    await act(async () => { transition.reject(new Error('identity transition failed')) })
    await act(async () => { store.setServiceOff(true) })
    await view.rerender(<DevicePromotionsGate store={store} actions={calls} />)
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(jest.mocked(haptic).mock.calls.filter(([kind]) => kind === 'select')).toHaveLength(1)
  })

  it('keeps a failed save open and lets the person retry', async () => {
    const { actions: calls, store, setItem } = await mountWithWrite(async () => { throw new Error('disk') })
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(store.snapshot()).toMatchObject({ read: 'loaded', save: 'unsaved' })
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toEqual({ disabled: false, busy: false })
    expect(haptic).not.toHaveBeenCalledWith('select')

    const retry = deferred()
    setItem.mockImplementation(() => retry.promise)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(calls.answer).toHaveBeenCalledTimes(2)
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục' }).props.accessibilityState).toEqual({ disabled: true, busy: true })
    expect(haptic).not.toHaveBeenCalledWith('select')
    await act(async () => { retry.resolve() })
    expect(store.snapshot().save).toBe('saved')
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(jest.mocked(haptic).mock.calls.filter(([kind]) => kind === 'select')).toHaveLength(1)
  })

  it('closes after a failed acceptance save followed by a successful decline save', async () => {
    const { actions: calls, store, setItem } = await mountWithWrite(async () => { throw new Error('disk') })
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(store.snapshot()).toMatchObject({ answer: 'accepted', save: 'unsaved' })
    expect(screen.getByText(TITLE)).toBeTruthy()
    expect(haptic).not.toHaveBeenCalledWith('select')

    const decline = deferred()
    setItem.mockImplementation(() => decline.promise)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Không nhận ưu đãi' }))
    })
    expect(calls.answer).toHaveBeenLastCalledWith('declined')
    expect(store.snapshot()).toMatchObject({ answer: 'declined', save: 'saving' })
    expect(screen.getByText(TITLE)).toBeTruthy()
    // The shared GhostBtn already emits press feedback; count completion only.
    jest.mocked(haptic).mockClear()

    await act(async () => { decline.resolve() })
    expect(store.snapshot()).toMatchObject({ answer: 'declined', save: 'saved' })
    expect(screen.queryByText(TITLE)).toBeNull()
    expect(jest.mocked(haptic).mock.calls.filter(([kind]) => kind === 'select')).toHaveLength(1)
  })

  it('records acceptance without state updates or haptic when unmounted during permission', async () => {
    const permission = deferred()
    // Capture the gate's four setters so post-unmount updates are checked directly.
    const setters: jest.Mock[] = []
    const useState = React.useState
    const state = jest.spyOn(React, 'useState')
    for (let index = 0; index < 4; index += 1) {
      state.mockImplementationOnce((initial?: unknown): [unknown, React.Dispatch<React.SetStateAction<unknown>>] => {
        const [value, setValue] = useState(initial)
        const setter = jest.fn(setValue)
        setters.push(setter)
        return [value, setter]
      })
    }
    try {
      const { actions: calls, store, view } = await mount()
      state.mockRestore()
      expect(setters).toHaveLength(4)
      calls.requestPermission.mockImplementationOnce(() => permission.promise)
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
      })
      await view.unmount()
      for (const setter of setters) setter.mockClear()
      jest.mocked(haptic).mockClear()
      await act(async () => { permission.resolve() })
      expect(calls.answer).toHaveBeenCalledTimes(1)
      expect(calls.answer).toHaveBeenCalledWith('accepted')
      expect(store.snapshot()).toMatchObject({ answer: 'accepted', save: 'saved' })
      for (const setter of setters) expect(setter).not.toHaveBeenCalled()
      expect(haptic).not.toHaveBeenCalled()

      await render(<DevicePromotionsGate store={store} actions={calls} />)
      await act(async () => {})
      expect(screen.queryByText(TITLE)).toBeNull()
    } finally {
      state.mockRestore()
    }
  })

  it('does not haptic after unmount while the answer write finishes', async () => {
    const write = deferred()
    const { store, view } = await mountWithWrite(() => write.promise)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục' }))
    })
    expect(store.snapshot().save).toBe('saving')
    await view.unmount()
    await act(async () => { write.resolve() })
    expect(store.snapshot().save).toBe('saved')
    expect(haptic).not.toHaveBeenCalledWith('select')
  })

  it('"Tiếp tục": the OS prompt first, then the answer', async () => {
    const { order } = await mount()
    await act(async () => {
      fireEvent.press(screen.getByText('Tiếp tục'))
    })
    expect(order).toEqual(['permission', 'accepted'])
  })

  it('a prompt that failed still records the answer: the switch is on and the OS note says why nothing arrives', async () => {
    const store = storeWith(null)
    const made = actions(store)
    made.actions.requestPermission.mockRejectedValueOnce(new Error('bridge'))
    await render(<DevicePromotionsGate store={store} actions={made.actions} />)
    await act(async () => {})
    await act(async () => {
      fireEvent.press(screen.getByText('Tiếp tục'))
    })
    expect(made.actions.answer).toHaveBeenCalledWith('accepted')
  })

  it('"Không nhận ưu đãi": no OS prompt', async () => {
    const { order } = await mount()
    await act(async () => {
      fireEvent.press(screen.getByText('Không nhận ưu đãi'))
    })
    expect(order).toEqual(['declined'])
  })
})

describe('the words', () => {
  it('states deletion as the owner set it, not "after 90 days" (D6)', async () => {
    await mount()
    const body = i18n.t('devicePromotions.sheet.body')
    expect(body).toContain('khoảng 90 ngày')
    expect(body).toContain('1 giờ')
    expect(body).toContain('30 ngày')
    expect(body).toContain('lỗi')
    expect(screen.getByText(body)).toBeTruthy()
  })
})
