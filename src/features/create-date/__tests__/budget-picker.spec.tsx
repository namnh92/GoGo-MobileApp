import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent, type KeyboardEventName } from 'react-native'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { act, fireEvent, within } from '@testing-library/react-native'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { renderScreen, loaded as mockLoaded, roomFor } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { BudgetPicker } from '../budget-picker.view'
import { budgetPickerSchema } from '../budget-picker'
import { BUDGET_TIERS, FLEXIBLE_BUDGET } from '../budget-tiers'
import CreateBudgetScreen from '../create-budget.view'
import CreatePlacesScreen from '../create-places.view'

const mockPush = jest.fn()
const mockCreate = jest.fn()
// Submission validation must work independently of draft persistence.
jest.mock('@/shared/store/savedRoomDraft', () => ({ saveRoomDraft: jest.fn(async () => undefined), clearSavedRoomDraft: jest.fn(async () => undefined) }))
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
async function openBudget() {
  const view = await renderScreen(<CreateBudgetScreen />)
  await fireEvent.press(view.getByTestId('create-budget-card'))
  return view
}


function PickerForm({ amount = 800_000, change = () => undefined }: { amount?: number; change?: (amount: number | null) => void }) {
  const form = useForm({ resolver: zodResolver(budgetPickerSchema), defaultValues: { budgetAmount: amount } })
  return <Controller control={form.control} name="budgetAmount" render={({ field }) =>
    <BudgetPicker {...field} roomType="couple" budgetMode="total" onChange={value => { field.onChange(value); change(value) }} />
  } />
}

// CreatePlacesScreen mounts a FlatList whose 50 ms cell-batching timer can
// otherwise fire between async act calls (or during RNTL cleanup) under load.
beforeEach(async () => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  useRoomStore.getState().resetDraft()
  // These budget/submit cases start after a valid required time step.
  useRoomStore.setState({ scheduleDay: '2031-01-14', startTime: '19:00', startAt: new Date(2031, 0, 14, 19).toISOString() })
  mockCreate.mockResolvedValue(roomFor('couple'))
  await act(async () => { await i18n.changeLanguage('vi') })
})

afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    jest.useRealTimers()
  }
})

it.each(['vi', 'en'])('keeps focused typing ungrouped and emits whole VND, retaining custom for a tier amount (%s)', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  const change = jest.fn()
  const view = await renderScreen(<PickerForm change={change} />)
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  const input = () => view.getByLabelText(inputLabel())
  expect(input().props.keyboardType).toBe('number-pad')
  expect(input().props.placeholder).toBe(i18n.t('budgetPicker.placeholder'))
  await fireEvent(input(), 'focus', {})
  for (const [typed, formatted, numeric] of [['6', '6', 6], ['65', '65', 65], ['6500', '6500', 6500], ['65000', '65000', 65000], ['650000', '650000', 650000]] as const) {
    await fireEvent.changeText(input(), typed)
    expect(input().props.value).toBe(formatted)
    expect(change).toHaveBeenLastCalledWith(numeric)
  }
  await fireEvent.changeText(input(), '800000')
  expect(input().props.value).toBe('800000')
  expect(view.getByRole('radio', { name: customLabel() }).props.accessibilityState.selected).toBe(true)
})

it('prefills non-tier amounts and keeps flexible as its existing ceiling', async () => {
  const change = jest.fn()
  const view = await renderScreen(<PickerForm amount={650_000} change={change} />)
  expect(view.getByRole('radio', { name: customLabel() }).props.accessibilityState.selected).toBe(true)
  expect(view.getByLabelText(inputLabel()).props.value).toBe('650.000')
  await fireEvent.press(view.getByRole('radio', { name: i18n.t('createBudget.range.flexible') }))
  expect(change).toHaveBeenLastCalledWith(FLEXIBLE_BUDGET)
  expect(view.queryByLabelText(inputLabel())).toBeNull()
})

it('keeps a fresh custom selection pristine while Confirm stays disabled', async () => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  expect(view.getByLabelText(inputLabel()).props.value).toBe('')
  expect(view.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
  expect(view.getByLabelText(inputLabel()).props['aria-invalid']).not.toBe(true)
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }).props.accessibilityState.disabled).toBe(true)
})

it.each([
  ['', 'budgetPicker.required'], ['9999', 'budgetPicker.bounds'], ['100000001', 'budgetPicker.bounds'],
])('shows an inline error and disables Confirm for custom %s', async (typed, key) => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  await fireEvent.changeText(view.getByLabelText(inputLabel()), typed)
  expect(view.getByText(i18n.t(key))).toBeTruthy()
  const next = view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })
  expect(next.props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(next)
  expect(mockPush).not.toHaveBeenCalled()
})

it.each([10_000, 100_000_000])('accepts the inclusive custom bound %i', async amount => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  await fireEvent.changeText(view.getByLabelText(inputLabel()), String(amount))
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }).props.accessibilityState.disabled).toBe(false)
})

it.each(['couple', 'group-host'] as const)('continues with a custom draft and creates the room with its ceiling (%s)', async audience => {
  useRoomStore.getState().setAudience(audience)
  if (audience === 'group-host') useRoomStore.getState().setBudgetMode('per_person')
  // A resumed custom draft must not round to 800k.
  useRoomStore.getState().patchDraft({ budgetAmount: 650_000 })
  const budget = await openBudget()
  const unit = audience === 'couple' ? i18n.t('createBudget.unit.couple') : i18n.t('datePlan.perPerson')
  const input = budget.getByLabelText(`${i18n.t('budgetPicker.amount')} ${unit}`)
  expect(input.props.value).toBe('650.000')
  await fireEvent.changeText(input, '675000')
  await fireEvent.press(budget.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }))
  await fireEvent.press(budget.getByRole('button', { name: i18n.t('common.continue') }))
  expect(mockPush).toHaveBeenCalledWith('/create/places')
  expect(useRoomStore.getState().budgetAmount).toBe(675_000)
  await budget.unmount()
  const places = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(places.getByRole('button', { name: i18n.t('createPlaces.cta') }))
  await act(async () => { jest.runOnlyPendingTimers() })
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ constraint: expect.objectContaining({
    budgetAmount: 675_000, budgetMode: audience === 'couple' ? 'total' : 'per_person',
  }) }))
})

it.each(['vi', 'en'])('F-14 retains invalid paste, blocks Confirm, and recovers with whole VND (%s)', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  const input = () => view.getByLabelText(inputLabel())
  const next = () => view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })
  await fireEvent(input(), 'focus', {})
  for (const text of ['650000.50', '650.000,50', '650x000', '650,000.50']) {
    await fireEvent.changeText(input(), text)
    expect(input().props.value).toBe(text)
    expect(view.getByText(i18n.t('budgetPicker.format'))).toBeTruthy()
    expect(next().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(next())
    expect(mockPush).not.toHaveBeenCalled()
  }
  for (const text of ['650000', '650.000', '650.000đ', '650,000']) {
    await fireEvent.changeText(input(), text)
    expect(input().props.value).toBe('650000')
    expect(view.queryByText(i18n.t('budgetPicker.format'))).toBeNull()
    expect(next().props.accessibilityState.disabled).toBe(false)
    expect(useRoomStore.getState().budgetAmount).toBeNull()
  }
  await fireEvent.press(next())
  expect(useRoomStore.getState().budgetAmount).toBe(650000)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('common.continue') }))
  expect(mockPush).toHaveBeenCalledWith('/create/places')
})


it('F-14 rejects select-all decimal paste over a grouped amount and keeps it after blur/focus', async () => {
  useRoomStore.getState().patchDraft({ budgetAmount: 10000 })
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  const input = () => view.getByLabelText(inputLabel())
  await fireEvent.changeText(input(), '10000')
  await fireEvent(input(), 'blur', {})
  await fireEvent(input(), 'focus', {})
  await fireEvent.changeText(input(), '10.0001')
  expect(input().props.value).toBe('10.0001')
  expect(view.getByText(i18n.t('budgetPicker.format'))).toBeTruthy()
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }).props.accessibilityState.disabled).toBe(true)
  await fireEvent(input(), 'blur', {})
  await fireEvent(input(), 'focus', {})
  expect(input().props.value).toBe('10.0001')
})

it('F-15 shows digits on focus, supports backspace and groups only on blur', async () => {
  const change = jest.fn()
  const view = await renderScreen(<PickerForm amount={650000} change={change} />)
  const input = () => view.getByLabelText(inputLabel())
  expect(input().props.value).toBe('650.000')
  await fireEvent(input(), 'focus', {})
  expect(input().props.value).toBe('650000')
  await fireEvent.changeText(input(), '65000')
  expect(input().props.value).toBe('65000')
  expect(change).toHaveBeenLastCalledWith(65000)
  expect(view.queryByText(i18n.t('budgetPicker.format'))).toBeNull()
  await fireEvent.changeText(input(), '650000')
  await fireEvent(input(), 'blur', {})
  expect(input().props.value).toBe('650.000')
})

it('shows an exact live budget preview while typing', async () => {
  const view = await renderScreen(<PickerForm amount={650000} />)
  const input = () => view.getByLabelText(inputLabel())
  expect(view.getByText('650.000đ / cả phòng (2 người)')).toBeTruthy()
  await fireEvent(input(), 'focus', {})
  await fireEvent.changeText(input(), '650001')
  expect(view.getByText('650.001đ / cả phòng (2 người)')).toBeTruthy()
})

it.each(['650.000đ', '650,000', ' 650.000 ₫ ', '650000 VND'])('normalizes valid paste to focused digits: %s', async text => {
  const change = jest.fn()
  const view = await renderScreen(<PickerForm amount={650000} change={change} />)
  const input = () => view.getByLabelText(inputLabel())
  await fireEvent(input(), 'focus', {})
  await fireEvent.changeText(input(), text)
  expect(input().props.value).toBe('650000')
  expect(change).toHaveBeenLastCalledWith(650000)
})

it.each(['650.00', '650000.50', '650.000,50', '1.2.3', '6 50'])('rejects malformed paste %s', async text => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  const input = () => view.getByLabelText(inputLabel())
  await fireEvent(input(), 'focus', {})
  await fireEvent.changeText(input(), text)
  expect(input().props.value).toBe(text)
  expect(view.getByText(i18n.t('budgetPicker.format'))).toBeTruthy()
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }).props.accessibilityState.disabled).toBe(true)
})

it('emits null when the focused amount is cleared', async () => {
  const change = jest.fn()
  const view = await renderScreen(<PickerForm amount={650000} change={change} />)
  await fireEvent(view.getByLabelText(inputLabel()), 'focus', {})
  await fireEvent.changeText(view.getByLabelText(inputLabel()), '')
  expect(change).toHaveBeenLastCalledWith(null)
})

it('F-16 associates errors and announces once per changed error', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined)
  const field = (error?: string) => <LabelledInput label="Amount" icon="payments" accessibilityHint="Existing hint" accessibilityState={{ disabled: true }} error={error} />
  const view = await renderScreen(field())
  expect(view.getByLabelText('Amount').props.accessibilityHint).toBe('Existing hint')
  expect(announce).not.toHaveBeenCalled()
  await view.rerender(field('Invalid amount'))
  expect(view.getByLabelText('Amount').props.accessibilityHint).toContain('Invalid amount')
  expect(view.getByLabelText('Amount').props.accessibilityHint).toContain('Existing hint')
  expect(view.getByLabelText('Amount').props['aria-invalid']).toBe(true)
  expect(view.getByLabelText('Amount').props.accessibilityState.disabled).toBe(true)
  expect(view.getByText('Invalid amount').props.accessibilityLiveRegion).toBe('polite')
  expect(announce).toHaveBeenCalledTimes(1)
  expect(announce).toHaveBeenLastCalledWith('Invalid amount')
  await view.rerender(field('Invalid amount'))
  expect(announce).toHaveBeenCalledTimes(1)
  await view.rerender(field('Out of bounds'))
  expect(announce).toHaveBeenCalledTimes(2)
  expect(announce).toHaveBeenLastCalledWith('Out of bounds')
  await view.rerender(field())
  expect(view.getByLabelText('Amount').props.accessibilityHint).toBe('Existing hint')
  expect(view.getByLabelText('Amount').props['aria-invalid']).not.toBe(true)
  expect(announce).toHaveBeenCalledTimes(2)
  announce.mockRestore()
})

it.each([NaN, null, Infinity, 650000.5, 9999, 100000001])('refuses final wizard submit for invalid custom budget %s', async budgetAmount => {
  useRoomStore.getState().patchDraft({ budgetAmount })
  const view = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createPlaces.cta') }))
  await act(async () => { jest.runOnlyPendingTimers() })
  expect(mockCreate).not.toHaveBeenCalled()
  expect(useRoomStore.getState().creationPending).toBe(false)
})


it('shows the required error after blurring an untouched custom amount', async () => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  await fireEvent(view.getByLabelText(inputLabel()), 'blur', {})
  expect(view.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
  expect(view.getByLabelText(inputLabel()).props['aria-invalid']).toBe(true)
})


it('uses one filled bordered budget box and recolours only that box on error', async () => {
  const view = await openBudget()
  await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
  const box = () => view.getByTestId('budget-input-box')
  const initial = StyleSheet.flatten(box().props.style)
  expect(initial.borderWidth).toBe(1)
  // The icon, input and suffix are direct children of the single shell.
  expect(view.getByLabelText(inputLabel()).parent).toBe(box())
  expect(within(box()).getByText(`đ ${i18n.t('createBudget.unit.couple')}`).parent).toBe(box())
  expect(StyleSheet.flatten(view.getByLabelText(inputLabel()).props.style).borderWidth).toBeUndefined()
  await fireEvent(view.getByLabelText(inputLabel()), 'blur', {})
  const invalid = StyleSheet.flatten(box().props.style)
  expect(invalid.borderColor).not.toBe(initial.borderColor)
  expect(invalid).toEqual({ ...initial, borderColor: invalid.borderColor })
})

it('focuses and reveals the custom input with its preview, including later focus with the keyboard open', async () => {
  const listeners: Partial<Record<KeyboardEventName, (event: KeyboardEvent) => void>> = {}
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: KeyboardEventName, callback: (event: KeyboardEvent) => void) => {
    listeners[name] = callback
    return { remove: jest.fn() }
  }) as unknown as typeof Keyboard.addListener)
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {})
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
    if (this.props.testID === 'room-budget-sheet-viewport') callback(0, 100, 390, 600)
    else if (this.props.testID === 'budget-custom-field') callback(16, 450, 358, 140)
    else callback(16, 450, 358, 80)
  })
  try {
    const view = await openBudget()
    await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
    expect(focus).toHaveBeenCalledTimes(1)
    await act(async () => { listeners.keyboardDidShow?.({ endCoordinates: { screenY: 550 } } as KeyboardEvent); jest.runOnlyPendingTimers() })
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 48 }))
    await fireEvent.changeText(view.getByLabelText(inputLabel()), '650000')
    expect(within(view.getByTestId('budget-custom-field')).getByText('650.000đ / cả phòng (2 người)')).toBeTruthy()
    move.mockClear()
    await fireEvent(view.getByLabelText(inputLabel()), 'blur', {})
    await fireEvent(view.getByLabelText(inputLabel()), 'focus', {})
    await act(async () => { jest.runOnlyPendingTimers() })
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 48 }))
    expect(StyleSheet.flatten(view.getByTestId('create-footer').props.style).position).not.toBe('absolute')
    expect(within(view.getByTestId('create-budget-viewport')).queryByTestId('create-footer')).toBeNull()
    await view.unmount()
  } finally {
    jest.restoreAllMocks()
  }
})

it('F-17 shows validation on a new submit attempt while custom is untouched', async () => {
  const view = await renderScreen(<BudgetPicker value={null} onChange={jest.fn()} roomType="couple" budgetMode="total" submitAttempt={3} />)
  expect(view.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
  await view.rerender(<BudgetPicker value={null} onChange={jest.fn()} roomType="couple" budgetMode="total" submitAttempt={4} />)
  expect(view.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
})


it('F-17 keeps each reopened custom choice pristine and announces only after blur', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined)
  try {
    useRoomStore.getState().patchDraft({ budgetAmount: 800000 })
    const view = await openBudget()
    for (let selection = 0; selection < 2; selection++) {
      await fireEvent.press(view.getByRole('radio', { name: i18n.t('createBudget.range.flexible') }))
      announce.mockClear()
      await fireEvent.press(view.getByRole('radio', { name: customLabel() }))
      const input = view.getByLabelText(inputLabel())
      expect(input.props.value).toBe('')
      expect(view.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
      expect(input.props['aria-invalid']).not.toBe(true)
      expect(announce).not.toHaveBeenCalled()
      await fireEvent(input, 'blur', {})
      expect(view.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
      expect(announce).toHaveBeenCalledWith(i18n.t('budgetPicker.required'))
      await fireEvent.press(view.getByRole('button', { name: i18n.t('common.cancel') }))
      await fireEvent.press(view.getByTestId('create-budget-card'))
    }
  } finally { announce.mockRestore() }
})

it.each(['vi', 'en'])('renders the original full-width cards, descriptions and radio checks, with custom last (%s)', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  useRoomStore.getState().patchDraft({ budgetAmount: 800000 })
  const view = await openBudget()
  const cards = within(view.getByTestId('room-budget-sheet-scroll')).getAllByRole('radio')
  expect(cards.map(card => card.props.testID)).toEqual([...BUDGET_TIERS.map(tier => `budget-option-${tier.key}`), 'budget-option-custom'])
  expect(view.queryByTestId('budget-custom-field')).toBeNull()
  for (const tier of BUDGET_TIERS) {
    const card = view.getByTestId(`budget-option-${tier.key}`)
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({ minHeight: 88, padding: 16, flexDirection: 'row' })
    expect(within(card).getByText(i18n.t(`createBudget.range.${tier.key}.sub`))).toBeTruthy()
    expect(card.props.accessibilityState).toMatchObject({ selected: tier.key === 'to800', checked: tier.key === 'to800' })
    expect(view.getByTestId(`budget-option-${tier.key}-radio`).children.length > 0).toBe(tier.key === 'to800')
  }
  expect(within(view.getByTestId('budget-option-to800')).getByText(`${i18n.t('createBudget.range.to800')} ${i18n.t('createBudget.unit.couple')}`)).toBeTruthy()
  const custom = view.getByTestId('budget-option-custom')
  expect(within(custom).getByText(i18n.t('budgetPicker.customDescription'))).toBeTruthy()
  await fireEvent.press(custom)
  expect(custom.props.accessibilityState).toMatchObject({ selected: true, checked: true })
  expect(view.getByTestId('budget-option-custom-radio').children).toHaveLength(1)
  expect(view.getByTestId('budget-custom-field')).toBeTruthy()
})

it.each(['couple', 'group-host'] as const)('round 6v: %s placeholder → staged tier → confirmed card → Continue', async audience => {
  useRoomStore.getState().setAudience(audience)
  const view = await renderScreen(<CreateBudgetScreen />)
  expect(within(view.getByTestId('create-budget-card')).getByText(i18n.t('budgetPicker.choose'))).toBeTruthy()
  expect(view.getByRole('button', { name: i18n.t('common.continue') })).toBeDisabled()
  expect(view.queryByTestId('budget-option-to500')).toBeNull()
  await fireEvent.press(view.getByTestId('create-budget-card'))
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })).toBeDisabled()
  expect(view.queryByTestId('budget-custom-field')).toBeNull()
  await fireEvent.press(view.getByTestId('budget-option-to500'))
  expect(useRoomStore.getState().budgetAmount).toBeNull()
  await fireEvent.press(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }))
  expect(within(view.getByTestId('create-budget-card')).getByText(/300.000đ – 500.000đ/)).toBeTruthy()
  expect(view.getByRole('button', { name: i18n.t('common.continue') })).toBeEnabled()
  await fireEvent.press(view.getByRole('button', { name: i18n.t('common.continue') }))
  expect(mockPush).toHaveBeenCalledWith('/create/places')
  expect(useRoomStore.getState().budgetAmount).toBe(500000)
})

it.each([null, 650000])('round 6v: Cancel discards tier/custom changes and errors (original %s)', async amount => {
  useRoomStore.getState().patchDraft({ budgetAmount: amount })
  const view = await openBudget()
  await fireEvent.press(view.getByTestId('budget-option-to500'))
  await fireEvent.press(view.getByRole('button', { name: i18n.t('common.cancel') }))
  expect(useRoomStore.getState().budgetAmount).toBe(amount)
  await fireEvent.press(view.getByTestId('create-budget-card'))
  await fireEvent.press(view.getByTestId('budget-option-custom'))
  await fireEvent.changeText(view.getByLabelText(inputLabel()), '650000.50')
  expect(view.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })).toBeDisabled()
  await fireEvent.press(view.getByRole('button', { name: i18n.t('common.cancel') }))
  expect(useRoomStore.getState().budgetAmount).toBe(amount)
  await fireEvent.press(view.getByTestId('create-budget-card'))
  expect(view.queryByText(i18n.t('budgetPicker.format'))).toBeNull()
  if (amount !== null) expect(view.getByLabelText(inputLabel()).props.value).toBe('650.000')
  else expect(view.queryByTestId('budget-custom-field')).toBeNull()
})

it('round 6v: group count → mode → amount share cards and update count/unit live', async () => {
  useRoomStore.getState().setAudience('group-host')
  useRoomStore.getState().patchDraft({ budgetAmount: 500000 })
  const view = await renderScreen(<CreateBudgetScreen />)
  expect(within(view.getByTestId('create-budget-scroll')).getAllByTestId(/^(group-budget-fields|create-budget-section)$/).map(node => node.props.testID))
    .toEqual(['group-budget-fields', 'create-budget-section'])
  const count = useRoomStore.getState().participantCount
  await fireEvent.press(view.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  expect(within(view.getByTestId('create-budget-card')).getByText(new RegExp(`${count + 1} người`))).toBeTruthy()
  await fireEvent.press(view.getByTestId('budget-mode-total'))
  expect(view.getByTestId('create-budget-card').props.accessibilityLabel).toContain(i18n.t('price.groupTotal'))
  await fireEvent.press(view.getByTestId('create-budget-card'))
  expect(view.getByTestId('budget-option-to500').props.accessibilityLabel).toContain(i18n.t('price.groupTotal'))
  expect(within(view.getByTestId('budget-option-to500')).getByText(new RegExp(`${count + 1} người`))).toBeTruthy()
  expect(useRoomStore.getState().budgetAmount).toBe(500000)
})
