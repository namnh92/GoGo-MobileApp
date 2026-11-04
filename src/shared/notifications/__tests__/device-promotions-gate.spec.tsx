import { act, fireEvent, render, screen } from '@testing-library/react-native'

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

import i18n from '@/shared/i18n'
import { markSplashHidden } from '@/shared/ui/splash-state'

import { DevicePromotionsGate, resetDevicePromotionsLaunch } from '../device-promotions-gate'
import { createDevicePromotionsStore } from '../device-promotions-store'

function storeWith(raw: string | null) {
  return createDevicePromotionsStore({
    storage: { getItem: async () => raw, setItem: async () => undefined },
  })
}

function actions() {
  const order: string[] = []
  return {
    order,
    actions: {
      requestPermission: jest.fn(async () => {
        order.push('permission')
      }),
      answer: jest.fn(async (answer: 'accepted' | 'declined') => {
        order.push(answer)
      }),
    },
  }
}

async function mount(raw: string | null = null) {
  const made = actions()
  const store = storeWith(raw)
  const view = await render(<DevicePromotionsGate store={store} actions={made.actions} />)
  await act(async () => {})
  return { ...made, store, view }
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
})

const TITLE = 'Nhận ưu đãi từ GoGo?'

describe('when it asks', () => {
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
    await render(<DevicePromotionsGate store={store} actions={actions().actions} />)
    await act(async () => {})
    expect(screen.queryByText(TITLE)).toBeNull()
  })
})

describe('what the answers do', () => {
  it('"Tiếp tục": the OS prompt first, then the answer', async () => {
    const { order } = await mount()
    await act(async () => {
      fireEvent.press(screen.getByText('Tiếp tục'))
    })
    expect(order).toEqual(['permission', 'accepted'])
  })

  it('a prompt that failed still records the answer: the switch is on and the OS note says why nothing arrives', async () => {
    const made = actions()
    made.actions.requestPermission.mockRejectedValueOnce(new Error('bridge'))
    await render(<DevicePromotionsGate store={storeWith(null)} actions={made.actions} />)
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
