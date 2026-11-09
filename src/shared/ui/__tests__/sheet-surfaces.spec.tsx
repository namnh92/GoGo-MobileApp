import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { themes, type AppTheme } from '../theme'
import i18n from '@/shared/i18n'

// Exercise the rendered controls with the real style factories in all accents
// and both modes. These are component checks, not native screenshots.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))

jest.mock('@/shared/location/use-current-location', () => ({ useCurrentLocation: () => ({ state: { status: 'idle' }, request: jest.fn() }) }))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: 'v1' }, refetch: jest.fn() }),
  useAdministrativeUnits: () => ({ data: [], refetch: jest.fn() }),
}))

const { AvatarSourceSheet } = jest.requireActual<typeof import('@/features/account/avatar-source-sheet.view')>('@/features/account/avatar-source-sheet.view')
const { BirthdaySheet } = jest.requireActual<typeof import('@/features/account/birthday-sheet.view')>('@/features/account/birthday-sheet.view')
const { CurrentAreaSheet } = jest.requireActual<typeof import('@/shared/location/current-area-sheet.view')>('@/shared/location/current-area-sheet.view')
const { ResultSheet } = jest.requireActual<typeof import('../result-sheet.view')>('../result-sheet.view')
const { AppHeader } = jest.requireActual<typeof import('../app-header.view')>('../app-header.view')
const { Sheet } = jest.requireActual<typeof import('../sheet.view')>('../sheet.view')
const { AdministrativePicker } = jest.requireActual<typeof import('@/shared/administrative/administrative-picker.view')>('@/shared/administrative/administrative-picker.view')

function expectHorizontalActions() {
  for (const row of screen.getAllByTestId('sheet-actions')) {
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
    for (const button of within(row).getAllByRole('button')) {
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0 })
    }
  }
}

describe.each(Object.entries(themes))('%s sheet surfaces', (_name, theme) => {
  beforeEach(() => { currentTheme = theme })

  it('sheet header shares the panel surface; all headers retain re-design row insets', async () => {
    await render(<Sheet visible onClose={jest.fn()} testID="header-sheet"
      header={<AppHeader variant="sheet" safeArea={false} title="Sheet" />}>
      <AppHeader testID="screen-header" safeArea={false} title="Screen" />
    </Sheet>)
    const header = screen.getByTestId('app-header')
    const panel = StyleSheet.flatten(screen.getByTestId('header-sheet').props.style)
    expect(panel.backgroundColor).toBe(theme.surface.card)
    expect(StyleSheet.flatten(header.props.style).backgroundColor).toBe(panel.backgroundColor)
    expect(StyleSheet.flatten((header.children[0] as typeof header).props.style).paddingHorizontal).toBe(theme.spacing[4])
    const screenHeader = screen.getByTestId('screen-header')
    expect(StyleSheet.flatten(screenHeader.props.style).backgroundColor).toBe(theme.surface.canvas)
    expect(StyleSheet.flatten((screenHeader.children[0] as typeof screenHeader).props.style).paddingHorizontal).toBe(theme.spacing[4])
  })

  it('area header and embedded province list share the discovery sheet surface', async () => {
    await render(<CurrentAreaSheet visible onClose={jest.fn()} onApplied={jest.fn()} />)
    const surface = StyleSheet.flatten(screen.getByTestId('discovery-location-sheet').props.style).backgroundColor
    expect(StyleSheet.flatten(screen.getByTestId('app-header').props.style).backgroundColor).toBe(surface)
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('areaPicker.selectProvince') }))
    expect(screen.getByRole('header', { name: i18n.t('administrative.province') })).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('app-header').props.style).backgroundColor).toBe(surface)
  })

  it.each(['province', 'commune'] as const)('standalone administrative %s list uses the sheet surface', async level => {
    await render(<AdministrativePicker value={{ datasetVersion: 'v1', provinceCode: '01', provinceName: 'Province', communeCode: null, communeName: null }} onChange={jest.fn()} />)
    await fireEvent.press(screen.getByRole('button', { name: level === 'province' ? 'Province' : i18n.t('administrative.wholeProvince') }))
    expect(screen.getByRole('header', { name: i18n.t(`administrative.${level}`) })).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId('app-header').props.style).backgroundColor).toBe(theme.surface.card)
  })

  it('uses a raised option surface, soft icon tints and a borderless neutral cancel; keeps only the hairline row divider', async () => {
    const choose = jest.fn()
    await render(<AvatarSourceSheet visible hasPhoto canUpload onClose={jest.fn()} onClosed={jest.fn()} onChoose={choose} />)
    expect(StyleSheet.flatten(screen.getByTestId('sheet-option-list').props.style)).toMatchObject({ backgroundColor: theme.surface.card, borderWidth: 0 })
    const chips = screen.getAllByTestId('sheet-icon-chip')
    expect(chips).toHaveLength(3)
    for (const chip of chips.slice(0, 2)) expect(StyleSheet.flatten(chip.props.style)).toMatchObject({ backgroundColor: theme.accent.soft, borderWidth: 0 })
    expect(StyleSheet.flatten(chips[2]!.props.style)).toMatchObject({ backgroundColor: theme.status.dangerSoft, borderWidth: 0 })
    const library = screen.getByRole('button', { name: i18n.t('account.avatarLibrary') })
    expect(StyleSheet.flatten(library.props.style)).toMatchObject({ borderTopWidth: unistyles.StyleSheet.hairlineWidth, borderTopColor: theme.border.hairline })
    const cancel = screen.getByRole('button', { name: i18n.t('common.cancel') })
    expect(StyleSheet.flatten(cancel.props.style)).toMatchObject({ borderWidth: 0, backgroundColor: theme.surface.subtle })
    await fireEvent.press(library)
    expect(choose).toHaveBeenCalledWith('library')
    expectHorizontalActions()
  })

  it('shared logout/delete confirmation has no outlined actions and preserves the destructive tint', async () => {
    await render(<ResultSheet visible variant="warning" title="Confirm" body="Confirm action"
      primaryAction={{ label: 'Confirm', destructive: true, onPress: jest.fn() }}
      secondaryAction={{ label: 'Cancel', onPress: jest.fn() }} onClose={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Cancel' }).props.style)).toMatchObject({ borderWidth: 0, backgroundColor: theme.surface.subtle })
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Confirm' }).props.style)).toMatchObject({ borderWidth: 0, backgroundColor: theme.status.dangerSoft })
    expectHorizontalActions()
  })

  it('birthday picker uses surfaces for close, summary, wheel selection', async () => {
    await render(<BirthdaySheet visible date={{ year: 1990, month: 5, day: 17 }} onChange={jest.fn()} onClose={jest.fn()} onConfirm={jest.fn()} />)
    const sheet = within(screen.getByTestId('birthday-sheet'))
    expect(StyleSheet.flatten(sheet.getByRole('button', { name: i18n.t('common.close') }).props.style)).toMatchObject({ backgroundColor: theme.surface.card, borderWidth: 0 })
    expect(sheet.queryByRole('button', { name: i18n.t('account.birthdayToday') })).toBeNull()
    expect(StyleSheet.flatten(sheet.getByRole('button', { name: i18n.t('common.cancel') }).props.style)).toMatchObject({ backgroundColor: theme.surface.subtle, borderWidth: 0 })
    expectHorizontalActions()
  })

  it('area picker actions are borderless; province fields use only the existing hairline token', async () => {
    await render(<CurrentAreaSheet visible onClose={jest.fn()} onApplied={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: i18n.t('home.useLocation') }).props.style)).toMatchObject({ backgroundColor: theme.surface.high, borderWidth: 0 })
    expect(StyleSheet.flatten(screen.getByRole('button', { name: i18n.t('administrative.clear') }).props.style).borderWidth).toBe(0)
    expect(StyleSheet.flatten(screen.getByRole('button', { name: i18n.t('areaPicker.selectProvince') }).props.style)).toMatchObject({ borderColor: theme.border.hairline })
    expectHorizontalActions()
  })
})
