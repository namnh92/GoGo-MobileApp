import { act, fireEvent, within } from '@testing-library/react-native'

import { loaded, pending, failed, renderScreen, roomFor, type QueryLike } from './harness'

/**
 * PROF-APP-004 (#179), ADR-0022 — saved interests are offered on the room
 * preference screen only while nothing is chosen and nothing was ever saved
 * for this room; a tap fills the local draft and nothing else. Autosave still
 * runs only when the person continues, and a guest never sees the chip.
 */

const mockMe: { query: QueryLike } = { query: loaded(undefined) }
const mockRoom: { query: QueryLike } = { query: loaded(undefined) }
const mockPreferences: { query: QueryLike } = { query: loaded({ selections: {}, version: 0 }) }
const mockTaxonomies = { query: loaded({ kinds: { mood: [
  { key: 'chill', labels: { vi: 'Thư giãn', en: 'Chill' } },
  { key: 'lively', labels: { vi: 'Sôi động', en: 'Lively' } },
  { key: 'cozy', labels: { vi: 'Ấm cúng', en: 'Cozy' } },
  { key: 'romantic', labels: { vi: 'Lãng mạn', en: 'Romantic' } },
] } }) }
const defaultTaxonomies = mockTaxonomies.query
const mockSave = jest.fn()
const mockComplete = jest.fn()
const mockSession = { status: 'user' as string }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
  useRoom: () => mockRoom.query,
  useMyPreferences: () => mockPreferences.query,
  useSaveMyPreferences: () => ({ mutateAsync: mockSave, isPending: false }),
  useCompleteMyPreferences: () => ({ mutateAsync: mockComplete, isPending: false }),
  useTaxonomies: () => mockTaxonomies.query,
}))

import { StyleSheet } from 'react-native'
import { themes, type AppTheme } from '@/shared/ui/theme'

// Evaluate the actual row styles in both modes instead of the stock mock's frozen theme.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => {
  const evaluate = () => typeof factory === 'function' ? factory(currentTheme, runtime) : factory
  return new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
    get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(evaluate(), key),
  })
})
const { default: PreferenceScreen } = jest.requireActual<typeof import('@/features/matching/preference.view')>('@/features/matching/preference.view')
import { useRoomStore } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'

const CHIP = 'Dùng sở thích đã lưu'

beforeEach(async () => {
  await i18n.changeLanguage('vi')
  currentTheme = themes.orange
  mockTaxonomies.query = defaultTaxonomies
  useRoomStore.getState().resetDraft()
  mockSession.status = 'user'
  mockRoom.query = loaded(roomFor('couple'))
  mockMe.query = loaded({ interests: { mood: ['chill', 'retired_key', 'cozy'] } })
  mockPreferences.query = loaded({ selections: {}, version: 0 })
  mockSave.mockReset()
  mockComplete.mockReset()
})

describe.each(['vi', 'en'])('preference privacy note in %s', locale => {
  beforeEach(async () => { await i18n.changeLanguage(locale) })
  it('shows the couple explanation', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getByText(i18n.t('gogoRoom.body'))).toBeTruthy()
    expect(view.queryByText(i18n.t('gogoRoom.body_group'))).toBeNull()
  })

  it.each([
    roomFor('group-host'),
    roomFor('group-guest'),
    roomFor('group-host', { participantCount: 2 }),
    roomFor('couple', { decisionMode: 'vote' }),
    roomFor('couple', { decisionMode: 'host' }),
    roomFor('couple', { participantCount: 4 }),
  ])('uses group wording for group facts: %j', async room => {
    mockRoom.query = loaded(room)
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getByText(i18n.t('gogoRoom.body_group'))).toBeTruthy()
    expect(view.queryByText(i18n.t('gogoRoom.body'))).toBeNull()
    expect(view.queryByText(/cả hai|hai người|couple/i)).toBeNull()
  })
})

describe('saved interests prefill on the preference screen', () => {
  it('offers the saved interests while nothing is chosen and nothing was saved', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('fills the local draft on a tap, skipping keys the room no longer offers, and saves nothing', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    await act(async () => {
      await fireEvent.press(view.getByText(CHIP))
    })
    expect(view.getByRole('checkbox', { name: 'Thư giãn', checked: true })).toBeTruthy()
    expect(view.getByRole('checkbox', { name: 'Ấm cúng', checked: true })).toBeTruthy()
    expect(view.getByText(/Tiếp tục \(2\)/)).toBeTruthy()
    expect(view.queryByText(CHIP)).toBeNull()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('is not offered once a draft was saved for this room, even an empty one', async () => {
    mockPreferences.query = loaded({ selections: { mood: [] }, version: 2 })
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('starts the host empty and offers profile prefill without a wizard handoff', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
    expect(view.getAllByRole('checkbox').every(row => !row.props.accessibilityState.checked)).toBe(true)
  })

  it('is never offered to a guest', async () => {
    mockSession.status = 'guest'
    mockMe.query = loaded(undefined)
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })
})


describe('preference checkbox criteria (#647)', () => {
  it('renders unchecked rows, keeps emoji and toggles checked state', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getAllByRole('checkbox', { checked: false })).toHaveLength(4)
    expect(view.getByText('😌')).toBeTruthy()
    await fireEvent.press(view.getByRole('checkbox', { name: 'Thư giãn' }))
    expect(view.getByRole('checkbox', { name: 'Thư giãn', checked: true })).toBeTruthy()
    expect(view.getByText('Đã chọn: 1/3 tiêu chí')).toBeTruthy()
    await fireEvent.press(view.getByRole('checkbox', { name: 'Thư giãn' }))
    expect(view.getByRole('checkbox', { name: 'Thư giãn', checked: false })).toBeTruthy()
  })

  it('requires two picks, caps at three and re-enables a fourth after deselection', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    const cta = () => view.getByRole('button', { name: /^Tiếp tục/ })
    expect(cta().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(cta())
    expect(mockSave).not.toHaveBeenCalled()
    await fireEvent.press(view.getByRole('checkbox', { name: 'Thư giãn' }))
    expect(cta().props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(view.getByRole('checkbox', { name: 'Sôi động' }))
    expect(cta().props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(view.getByRole('checkbox', { name: 'Ấm cúng' }))
    const fourth = () => view.getByRole('checkbox', { name: 'Lãng mạn' })
    expect(fourth().props.accessibilityState).toEqual({ checked: false, disabled: true })
    expect(fourth().props.accessibilityHint).toBe(i18n.t('placeWizard.selectionLimitHint', { max: 3 }))
    await fireEvent.press(fourth())
    expect(view.getAllByRole('checkbox', { checked: true })).toHaveLength(3)
    expect(view.getByText('Đã chọn: 3/3 tiêu chí')).toBeTruthy()
    expect(view.getByRole('button', { name: 'Tiếp tục (3)' })).toBeTruthy()
    await fireEvent.press(view.getByRole('checkbox', { name: 'Thư giãn' }))
    expect(fourth().props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(fourth())
    expect(fourth().props.accessibilityState.checked).toBe(true)
    await fireEvent.press(view.getByRole('button', { name: 'Tiếp tục (3)' }))
    expect(mockSave).toHaveBeenCalledWith({ selections: { mood: ['lively', 'cozy', 'romantic'] }, expectedVersion: 0 })
    expect(mockComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps the saved selection, version and save-then-complete payload', async () => {
    mockPreferences.query = loaded({ selections: { mood: ['cozy', 'chill'] }, version: 7 })
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getAllByRole('checkbox', { checked: true })).toHaveLength(2)
    await fireEvent.press(view.getByRole('button', { name: 'Tiếp tục (2)' }))
    expect(mockSave).toHaveBeenCalledWith({ selections: { mood: ['cozy', 'chill'] }, expectedVersion: 7 })
    expect(mockComplete).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.invocationCallOrder[0]).toBeLessThan(mockComplete.mock.invocationCallOrder[0])
  })

  it.each([
    ['orange', 'vi', 'Thư giãn'], ['orangeDark', 'vi', 'Thư giãn'],
    ['orange', 'en', 'Chill'], ['orangeDark', 'en', 'Chill'],
  ] as const)('uses AppToken row/text/selection colors and localized copy in %s / %s', async (theme, locale, label) => {
    currentTheme = themes[theme]
    await i18n.changeLanguage(locale)
    mockPreferences.query = loaded({ selections: { mood: ['chill', 'cozy'] }, version: 1 })
    const view = await renderScreen(<PreferenceScreen />)
    const row = view.getByRole('checkbox', { name: label, checked: true })
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      backgroundColor: currentTheme.surface.subtle,
      borderColor: currentTheme.accent.text,
      minHeight: 44,
    })
    expect(StyleSheet.flatten(within(row).getByText(label).props.style).color).toBe(currentTheme.text.primary)
    expect(view.getByText(i18n.t('preference.selectedCount', { n: 2, max: 3 }))).toBeTruthy()
    expect(view.getByRole('button', { name: `${i18n.t('common.continue')} (2)` })).toBeTruthy()
  })

  it.each(['pending', 'error', 'empty'] as const)('preserves the %s query state without criteria', async state => {
    mockTaxonomies.query = state === 'pending' ? pending() : state === 'error' ? failed() : loaded({ kinds: { mood: [] } })
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryAllByRole('checkbox')).toHaveLength(0)
    if (state === 'empty') expect(view.getByText('Đã chọn: 0/3 tiêu chí')).toBeTruthy()
    else expect(view.queryByText('Bạn đang\nmuốn gì hơn?')).toBeNull()
  })

  it('keeps save errors visible and does not complete failed saves', async () => {
    mockSave.mockRejectedValueOnce(new Error('offline'))
    mockPreferences.query = loaded({ selections: { mood: ['chill', 'cozy'] }, version: 1 })
    const view = await renderScreen(<PreferenceScreen />)
    await fireEvent.press(view.getByRole('button', { name: 'Tiếp tục (2)' }))
    expect(view.getByText(i18n.t('preference.saveFailed'))).toBeTruthy()
    expect(mockComplete).not.toHaveBeenCalled()
  })
})
