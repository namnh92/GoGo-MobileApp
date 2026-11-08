import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import '@/shared/i18n'

jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
}))
// StyleSheet mocks resolve their theme when the stylesheet module loads.
UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as typeof themes })
const { ContributionWizard } = jest.requireActual<typeof import('@/features/place-import/contribution-wizard.view')>('@/features/place-import/contribution-wizard.view')
const { styles } = jest.requireActual<typeof import('@/features/place-import/contribution-wizard.style')>('@/features/place-import/contribution-wizard.style')

it('uses dark role tokens in the wizard and keeps every action in the shared row', async () => {
  await render(<ContributionWizard googlePlaceId="place-a" registered online submitting={false} blocked={false}
    onSubmit={jest.fn()} onBack={jest.fn()} onFocus={jest.fn()} />)
  expect(styles.card.backgroundColor).toBe(themes.orangeDark.surface.card)
  expect(styles.currentLine.backgroundColor).toBe(themes.orangeDark.accent.primary)
  expect(styles.input.color).toBe(themes.orangeDark.text.primary)
  const bar = within(screen.getByTestId('contribution-action-bar'))
  expect(StyleSheet.flatten(bar.getByTestId('glass-bar-wash').props.style).backgroundColor).toBe(themes.orangeDark.glass.bar.wash)
  expect(bar.getAllByRole('button')).toHaveLength(2)
  await fireEvent.press(screen.getByRole('button', { name: 'Cặp đôi' }))
  await fireEvent.press(bar.getByRole('button', { name: 'Tiếp tục' }))
  expect(bar.getAllByRole('button')).toHaveLength(3)
  await fireEvent.press(screen.getByRole('button', { name: 'Sôi động' }))
  await fireEvent.press(bar.getByRole('button', { name: 'Tiếp tục' }))
  expect(bar.getByRole('button', { name: 'Gửi' })).toBeTruthy()
  expect(StyleSheet.flatten(bar.getByTestId('sheet-actions').props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
})
