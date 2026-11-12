import { act, fireEvent } from '@testing-library/react-native'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { renderScreen, loaded as mockLoaded, roomFor } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { BudgetPicker } from '../budget-picker.view'
import { budgetPickerSchema } from '../budget-picker'
import { FLEXIBLE_BUDGET } from '../budget-tiers'
import CreateBudgetScreen from '../create-budget.view'
import CreateMoodScreen from '../create-mood.view'

const mockPush = jest.fn()
const mockCreate = jest.fn()
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ usualBudget: null }),
  useTaxonomies: () => mockLoaded({ kinds: { mood: [], setting: [], spending_style: [] } }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: mockCreate }),
}))

const inputLabel = () => `${i18n.t('budgetPicker.amount')} ${i18n.t('createBudget.unit.couple')}`
const customLabel = () => i18n.t('budgetPicker.custom')

function PickerForm({ amount = 800_000, change = () => undefined }: { amount?: number; change?: (amount: number) => void }) {
  const form = useForm({ resolver: zodResolver(budgetPickerSchema), defaultValues: { budgetAmount: amount } })
  return <Controller control={form.control} name="budgetAmount" render={({ field }) =>
    <BudgetPicker {...field} roomType="couple" budgetMode="total" onChange={value => { field.onChange(value); change(value) }} />
  } />
}

beforeEach(async () => {
  jest.clearAllMocks()
  useRoomStore.getState().resetDraft()
  mockCreate.mockResolvedValue(roomFor('couple'))
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each(['vi', 'en'])('formats while typing and emits whole VND minor units, retaining custom for a tier amount (%s)', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  const change = jest.fn()
  const view = await renderScreen(<PickerForm change={change} />)
  await fireEvent.press(view.getByRole('button', { name: customLabel() }))
  const input = () => view.getByLabelText(inputLabel())
  expect(input().props.keyboardType).toBe('number-pad')
  expect(input().props.placeholder).toBe(i18n.t('budgetPicker.placeholder'))
  for (const [typed, formatted, numeric] of [['6', '6', 6], ['65', '65', 65], ['6500', '6.500', 6500], ['6.5000', '65.000', 65000], ['65.0000', '650.000', 650000]] as const) {
    await fireEvent.changeText(input(), typed)
    expect(input().props.value).toBe(formatted)
    expect(change).toHaveBeenLastCalledWith(numeric)
  }
  await fireEvent.changeText(input(), '800000')
  expect(input().props.value).toBe('800.000')
  expect(view.getByRole('button', { name: customLabel() }).props.accessibilityState.selected).toBe(true)
})

it('prefills non-tier amounts and keeps flexible as its existing ceiling', async () => {
  const change = jest.fn()
  const view = await renderScreen(<PickerForm amount={650_000} change={change} />)
  expect(view.getByRole('button', { name: customLabel() }).props.accessibilityState.selected).toBe(true)
  expect(view.getByLabelText(inputLabel()).props.value).toBe('650.000')
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createBudget.range.flexible') }))
  expect(change).toHaveBeenLastCalledWith(FLEXIBLE_BUDGET)
  expect(view.queryByLabelText(inputLabel())).toBeNull()
})

it('requires an amount on a fresh custom selection', async () => {
  const view = await renderScreen(<CreateBudgetScreen />)
  await fireEvent.press(view.getByRole('button', { name: customLabel() }))
  expect(view.getByLabelText(inputLabel()).props.value).toBe('')
  expect(view.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
  expect(view.getByRole('button', { name: i18n.t('common.continue') }).props.accessibilityState.disabled).toBe(true)
})

it.each([
  ['', 'budgetPicker.required'], ['9999', 'budgetPicker.bounds'], ['100000001', 'budgetPicker.bounds'],
])('shows an inline error and disables Continue for custom %s', async (typed, key) => {
  const view = await renderScreen(<CreateBudgetScreen />)
  await fireEvent.press(view.getByRole('button', { name: customLabel() }))
  await fireEvent.changeText(view.getByLabelText(inputLabel()), typed)
  expect(view.getByText(i18n.t(key))).toBeTruthy()
  const next = view.getByRole('button', { name: i18n.t('common.continue') })
  expect(next.props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(next)
  expect(mockPush).not.toHaveBeenCalled()
})

it.each([10_000, 100_000_000])('accepts the inclusive custom bound %i', async amount => {
  const view = await renderScreen(<CreateBudgetScreen />)
  await fireEvent.press(view.getByRole('button', { name: customLabel() }))
  await fireEvent.changeText(view.getByLabelText(inputLabel()), String(amount))
  expect(view.getByRole('button', { name: i18n.t('common.continue') }).props.accessibilityState.disabled).toBe(false)
})

it.each(['couple', 'group-host'] as const)('continues with a custom draft and creates the room with its ceiling (%s)', async audience => {
  useRoomStore.getState().setAudience(audience)
  if (audience === 'group-host') useRoomStore.getState().setBudgetMode('per_person')
  // A resumed custom draft must not round to 800k.
  useRoomStore.getState().patchDraft({ budgetAmount: 650_000 })
  const budget = await renderScreen(<CreateBudgetScreen />)
  const unit = audience === 'couple' ? i18n.t('createBudget.unit.couple') : i18n.t('datePlan.perPerson')
  const input = budget.getByLabelText(`${i18n.t('budgetPicker.amount')} ${unit}`)
  expect(input.props.value).toBe('650.000')
  await fireEvent.changeText(input, '675000')
  await fireEvent.press(budget.getByRole('button', { name: i18n.t('common.continue') }))
  expect(mockPush).toHaveBeenCalledWith('/create/mood')
  expect(useRoomStore.getState().budgetAmount).toBe(675_000)
  await budget.unmount()
  const mood = await renderScreen(<CreateMoodScreen />)
  await fireEvent.press(mood.getByRole('button', { name: i18n.t('createMood.cta') }))
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ constraint: expect.objectContaining({
    budgetAmount: 675_000, budgetMode: audience === 'couple' ? 'total' : 'per_person',
  }) }))
})
