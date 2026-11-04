import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-MobileApp#398 (shape D5, R-16) — the promotions switch of a device with no
 * account. Off is not claimed before the provider showed it, and a control that
 * cannot work says why.
 */

const mockIdentity = { setPromotions: jest.fn(async (_next: boolean) => undefined) }
const mockPermission = {
  status: jest.fn(async () => 'granted'),
  request: jest.fn(async () => ({ kind: 'granted' })),
}
let mockSnapshot: Record<string, unknown>
const mockStore = {
  load: jest.fn(async () => mockSnapshot),
  snapshot: () => mockSnapshot,
  subscribe: () => () => undefined,
  retrySave: jest.fn(),
}

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    useEffect(effect, [effect])
  },
}))
jest.mock('@/shared/notifications/identity-bootstrap', () => ({
  pushIdentity: { setPromotions: (next: boolean) => mockIdentity.setPromotions(next) },
}))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({
  pushPermission: { status: () => mockPermission.status(), request: () => mockPermission.request() },
}))
jest.mock('@/shared/notifications/device-promotions-store', () => ({
  devicePromotionsStore: {
    load: () => mockStore.load(),
    snapshot: () => mockStore.snapshot(),
    subscribe: () => mockStore.subscribe(),
    retrySave: () => mockStore.retrySave(),
  },
}))

import { DevicePromotionsSection } from '@/features/settings/device-promotions.view'

const LABEL = 'Thông báo ưu đãi từ GoGo'

const snapshot = (over: Record<string, unknown> = {}) => ({
  read: 'loaded',
  answer: 'accepted',
  enabled: true,
  version: 1,
  pendingVersion: null,
  awaitingProviderOff: false,
  save: 'saved',
  serviceOff: false,
  ...over,
})

async function mount() {
  const view = await renderScreen(<DevicePromotionsSection />)
  await act(async () => {})
  return view
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSnapshot = snapshot()
  mockPermission.status.mockResolvedValue('granted')
})

it('stands in a skeleton while the stored choice is read', async () => {
  mockSnapshot = snapshot({ read: 'loading' })
  const view = await mount()
  expect(view.queryByLabelText(LABEL)).toBeNull()
  expect(view.getByLabelText('Đang tải…')).toBeTruthy()
})

it('reads on for an accepted disclosure, off for no answer and for a decline', async () => {
  const on = await mount()
  expect(on.getByLabelText(LABEL).props.value).toBe(true)
  await on.unmount()

  for (const answer of [null, 'declined']) {
    mockSnapshot = snapshot({ answer, enabled: answer === null })
    const off = await mount()
    expect(off.getByLabelText(LABEL).props.value).toBe(false)
    await off.unmount()
  }
})

it('turning off goes straight to the coordinator, with no OS prompt', async () => {
  const view = await mount()
  await act(async () => {
    fireEvent(view.getByLabelText(LABEL), 'valueChange', false)
  })
  expect(mockIdentity.setPromotions).toHaveBeenCalledWith(false)
  expect(mockPermission.request).not.toHaveBeenCalled()
})

it('turning on asks the OS first: the person asked for notifications', async () => {
  mockSnapshot = snapshot({ answer: 'declined', enabled: false })
  const view = await mount()
  await act(async () => {
    fireEvent(view.getByLabelText(LABEL), 'valueChange', true)
  })
  expect(mockPermission.request).toHaveBeenCalled()
  expect(mockIdentity.setPromotions).toHaveBeenCalledWith(true)
})

it('says "Đang tắt…" until the provider has shown it (R-16)', async () => {
  mockSnapshot = snapshot({ enabled: false, awaitingProviderOff: true })
  const view = await mount()
  expect(view.getByText('Đang tắt…')).toBeTruthy()
})

it('flag off: the switch is locked and says why', async () => {
  mockSnapshot = snapshot({ serviceOff: true })
  const view = await mount()
  expect(view.getByLabelText(LABEL).props.disabled).toBe(true)
  expect(view.getByText('Hiện chưa dùng được tính năng này.')).toBeTruthy()
})

it('a choice it could not read stays locked, with no invented value', async () => {
  mockSnapshot = snapshot({ read: 'unreadable', answer: null })
  const view = await mount()
  expect(view.getByLabelText(LABEL).props.disabled).toBe(true)
  expect(view.getByLabelText(LABEL).props.value).toBe(false)
  expect(view.getByText('Chưa đọc được lựa chọn đã lưu trên máy này.')).toBeTruthy()
})

it('a write that failed offers a retry', async () => {
  mockSnapshot = snapshot({ save: 'unsaved' })
  const view = await mount()
  await act(async () => {
    fireEvent.press(view.getByText('Thử lại'))
  })
  expect(mockStore.retrySave).toHaveBeenCalled()
})

it('on, with the OS refusing: says nothing can arrive and links to Settings', async () => {
  mockPermission.status.mockResolvedValue('askable')
  const view = await mount()
  expect(view.getByText('Máy đang tắt thông báo cho GoGo nên chưa nhận được ưu đãi.')).toBeTruthy()
})
