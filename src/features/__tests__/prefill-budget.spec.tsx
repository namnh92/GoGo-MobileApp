import { act, fireEvent } from '@testing-library/react-native'

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
import { useRoomStore } from '@/shared/store/roomStore'

const CHIP = /Dùng ngân sách thường dùng: 300–500k/

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  useRoomStore.getState().setBudgetMode('per_person')
  mockMe.query = loaded({ usualBudget: { perPerson: 400_000, currency: 'VND' } })
  mockPush.mockClear()
})

describe('usual budget prefill on the budget step', () => {
  it('offers the tier the usual amount falls into', async () => {
    const view = await renderScreen(<CreateBudgetScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
  })

  it('selects that tier on a tap, and the amount lands in the draft on continue', async () => {
    const view = await renderScreen(<CreateBudgetScreen />)
    await act(async () => {
      fireEvent.press(view.getByText(CHIP))
    })
    expect(useRoomStore.getState().budgetAmount).toBeNull()
    await act(async () => {
      fireEvent.press(view.getByText('Tiếp tục'))
    })
    expect(useRoomStore.getState().budgetAmount).toBe(500_000)
    expect(mockPush).toHaveBeenCalledWith('/create/mood')
  })

  it('is not offered when the room budget is a group total', async () => {
    useRoomStore.getState().setBudgetMode('total')
    const view = await renderScreen(<CreateBudgetScreen />)
    expect(view.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
  })

  it('is not offered once the draft has an amount, nor without a usual budget', async () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 800_000 })
    const set = await renderScreen(<CreateBudgetScreen />)
    expect(set.queryByText(/Dùng ngân sách thường dùng/)).toBeNull()
    set.unmount()

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
