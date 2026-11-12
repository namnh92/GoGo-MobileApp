import { act, fireEvent, within } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

/**
 * PROF-APP-004 (#179), ADR-0022 — the usual budget is per person, so it is
 * offered only when the room counts per person, only while the draft holds no
 * amount, and it selects a tier only on a tap. The amount reaches the draft the
 * way it always did: when the person continues.
 */

const mockMe: { query: QueryLike } = { query: loaded(undefined) }
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user' }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
}))

import CreateBudgetScreen from '@/features/create-date/create-budget.view'
import { tierForAmount } from '@/features/create-date/budget-tiers'
import { toCreateRoomBody, useRoomStore } from '@/shared/store/roomStore'

const CHIP = /Dùng ngân sách thường dùng: 300.000đ – 500.000đ \/người/

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  // Budget prefill starts after the required time step.
  useRoomStore.setState({ scheduleDay: '2031-01-14', startTime: '19:00', startAt: new Date(2031, 0, 14, 19).toISOString() })
  // APP-037 (#189): the saved amount is per person, so the chip belongs to a
  // room whose budget is per person — a group whose host chose that unit. A
  // couple room is a total for two and gets its own case below.
  useRoomStore.getState().setAudience('group-host')
  useRoomStore.getState().setBudgetMode('per_person')
  mockMe.query = loaded({ usualBudget: { perPerson: 400_000, currency: 'VND' } })
  mockPush.mockClear()
})

describe('usual budget prefill on the budget step', () => {
  it('offers the tier the usual amount falls into', async () => {
    const view = await renderScreen(<CreateBudgetScreen />)
    expect(view.getByRole('button', { name: CHIP })).toBeTruthy()
  })

  it('renders the prefill amount and unit without ellipsis and includes both in its accessible label (#594 F-02)', async () => {
    const view = await renderScreen(<CreateBudgetScreen />)
    const action = view.getByRole('button', { name: CHIP })
    expect(action.props.accessibilityLabel).toContain('300.000đ – 500.000đ /người')
    for (const amount of view.getAllByText(/300.000đ – 500.000đ \/người/)) {
      expect(amount.props.numberOfLines ?? 0).toBe(0)
      expect(amount.props.ellipsizeMode).not.toBe('tail')
    }
  })

  it('keeps a tapped tier in the resumable draft before continuing', async () => {
    const view = await renderScreen(<CreateBudgetScreen />)
    await act(async () => {
      await fireEvent.press(view.getByRole('button', { name: CHIP }))
    })
    expect(useRoomStore.getState().budgetAmount).toBe(500_000)
    await act(async () => {
      await fireEvent.press(view.getByText('Tiếp tục'))
    })
    expect(useRoomStore.getState().budgetAmount).toBe(500_000)
    expect(mockPush).toHaveBeenCalledWith('/create/places')
  })

  it('is not offered when the room budget is a group total', async () => {
    useRoomStore.getState().setBudgetMode('total')
    const view = await renderScreen(<CreateBudgetScreen />)
    expect(view.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
  })

  /**
   * APP-037 (#189) — a couple is asked for a total for two, so a saved
   * per-person amount is the wrong unit to offer, whatever the store default
   * happens to be.
   */
  it('is never offered in a couple room, which asks for a total for two', async () => {
    useRoomStore.getState().setAudience('couple')
    useRoomStore.getState().setBudgetMode('per_person')
    const view = await renderScreen(<CreateBudgetScreen />)
    expect(view.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
  })

  it('is not offered once the draft has an amount, nor without a usual budget', async () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 800_000 })
    const set = await renderScreen(<CreateBudgetScreen />)
    expect(set.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
    await set.unmount()

    useRoomStore.getState().resetDraft()
    mockMe.query = loaded({ usualBudget: null })
    const none = await renderScreen(<CreateBudgetScreen />)
    expect(none.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
  })

  it('maps an amount to the first tier that covers it, or the open-ended one', () => {
    expect(tierForAmount(100_000).key).toBe('under300')
    expect(tierForAmount(300_000).key).toBe('under300')
    expect(tierForAmount(300_001).key).toBe('to500')
    expect(tierForAmount(1_500_000).key).toBe('to1500')
    expect(tierForAmount(9_000_000).key).toBe('flexible')
  })
})

// #333: at 375pt the last tier sat under the bottom bar of a step that could
// not scroll. The step's content now lives in a scroll view.
it('keeps the last tier inside the shared sheet scroll view (#333)', async () => {
  const view = await renderScreen(<CreateBudgetScreen />)
  // A real scroll view (host RCTScrollView), not a View that kept the test ID.
  const scroll = view.getByTestId('create-budget-scroll')
  expect(scroll.type).toBe('RCTScrollView')
  await fireEvent.press(view.getByTestId('create-budget-card'))
  expect(within(view.getByTestId('room-budget-sheet-scroll')).getByText('Không quan trọng')).toBeTruthy()
})

// #594: the same stored tier keeps its scope on every rendered amount.
it.each([
  ['couple', 'per_person', '/ cả phòng (2 người)', 'total'],
  ['group-host', 'per_person', '/người', 'per_person'],
  ['group-host', 'total', 'tổng nhóm', 'total'],
] as const)('shows units for %s / %s without changing the submitted amount', async (audience, mode, unit, expectedMode) => {
  useRoomStore.getState().setAudience(audience)
  useRoomStore.getState().setBudgetMode(mode)
  const view = await renderScreen(<CreateBudgetScreen />)
  await fireEvent.press(view.getByTestId('create-budget-card'))
  const tier = view.getByRole('radio', { name: /^300.000đ – 500.000đ / })
  expect(within(tier).getByText(`300.000đ – 500.000đ ${unit}`)).toBeTruthy()
  await fireEvent.press(tier)
  await fireEvent.press(view.getByText('Xác nhận'))
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(toCreateRoomBody(useRoomStore.getState()).constraint).toMatchObject({ budgetMode: expectedMode, budgetAmount: 500_000 })
  if (audience === 'group-host') expect(view.queryByText(/cả hai|hai người/)).toBeNull()
})
