jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => mockUnread }))

import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import i18n from '@/shared/i18n'
import { AppHeader, AppHeaderAction, type AppHeaderProps } from '../app-header.view'
import { MaterialIcon } from '../material-icon'
import { spacing, touchTarget } from '../tokens'
import { scopeHitSlop, styles as searchStyles } from '@/features/search/search.style'

const mockPush = jest.fn()
let mockUnread = { count: 0, more: false }
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, number | string>
beforeEach(() => { mockPush.mockClear(); mockUnread = { count: 0, more: false } })

const variants = ['tab-root', 'sub-screen', 'sheet'] as const satisfies readonly NonNullable<AppHeaderProps['variant']>[]
const navigableVariants = variants.filter(variant => variant !== 'sheet')

it.each(navigableVariants.flatMap(variant => [0, 1, 12].flatMap(count => [false, true].map(more => ({ variant, count, more })))))('uses one unread rule for $variant ($count/$more)', async ({ count, more, ...props }) => {
  mockUnread = { count, more }
  const view = await render(<AppHeader {...props} title={i18n.t('plans.title')} onBack={props.variant === 'sub-screen' ? jest.fn() : undefined} />)
  const header = within(screen.getByTestId('app-header'))
  const bell = header.getByTestId('app-header-bell')
  expect(header.queryAllByTestId('app-header-unread-dot')).toHaveLength(count > 0 ? 1 : 0)
  expect(flat(bell.props.style)).toMatchObject({ width: touchTarget.min, height: touchTarget.min })
  expect(bell.props.accessibilityLabel).toBe(count ? i18n.t('home.bellUnread', { count: count > 9 ? '9+' : more ? `${count}+` : `${count}` }) : i18n.t('notifications.title'))
  await fireEvent.press(bell)
  expect(mockPush).toHaveBeenCalledWith('/notifications')
  // Same mounted header follows an inbox update, including clearing the last unread row.
  mockUnread = { count: 0, more: false }
  await view.rerender(<AppHeader {...props} title={i18n.t('plans.title')} />)
  expect(screen.queryByTestId('app-header-unread-dot')).toBeNull()
})

it('owns the safe area, heading, back and optional save target', async () => {
  const back = jest.fn()
  const save = jest.fn()
  await render(<AppHeader title={i18n.t('account.title')} onBack={back} rightAction={<AppHeaderAction accessibilityLabel="Lưu" onPress={save}><MaterialIcon name="check" /></AppHeaderAction>} />)
  expect(flat(screen.getByTestId('app-header').props.style)).toMatchObject({ paddingTop: 47, paddingLeft: 0, paddingRight: 0 })
  expect(screen.getByRole('header', { name: i18n.t('account.title') })).toBeTruthy()
  for (const name of [i18n.t('common.back'), 'Lưu']) {
    const button = screen.getByRole('button', { name })
    expect(flat(button.props.style)).toMatchObject({ minHeight: 44, minWidth: 44 })
    await fireEvent.press(button)
  }
  expect(back).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledTimes(1)
})

it.each(variants)('keeps the %s title left-aligned with back and multiple actions', async variant => {
  await render(<AppHeader variant={variant} title="A long title that can wrap on a small phone" onBack={jest.fn()} rightAction={<AppHeaderAction accessibilityLabel="Help" onPress={jest.fn()}><MaterialIcon name="help" /></AppHeaderAction>} />)
  const title = screen.getByRole('header')
  expect(flat(title.props.style).textAlign).toBe('left')
  expect(title.props.numberOfLines).toBeUndefined()
})

it('omits the bell and unread dot in a sheet while retaining local actions', async () => {
  mockUnread = { count: 12, more: true }
  const back = jest.fn()
  const help = jest.fn()
  await render(<AppHeader variant="sheet" title="Sheet" onBack={back} rightAction={<AppHeaderAction accessibilityLabel="Help" onPress={help}><MaterialIcon name="help" /></AppHeaderAction>} />)
  expect(screen.queryByTestId('app-header-bell')).toBeNull()
  expect(screen.queryByTestId('app-header-unread-dot')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
  await fireEvent.press(screen.getByRole('button', { name: 'Help' }))
  expect(back).toHaveBeenCalledTimes(1)
  expect(help).toHaveBeenCalledTimes(1)
  expect(mockPush).not.toHaveBeenCalled()
})

it.each([0, 12])('omits profile notification navigation with %s unread items and retains back/save', async count => {
  mockUnread = { count, more: count > 0 }
  const back = jest.fn()
  const save = jest.fn()
  await render(<AppHeader showNotifications={false} title={i18n.t('account.title')} onBack={back}
    rightAction={<AppHeaderAction accessibilityLabel="Save" onPress={save}><MaterialIcon name="check" /></AppHeaderAction>} />)
  expect(screen.queryByTestId('app-header-bell')).toBeNull()
  expect(screen.queryByTestId('app-header-unread-dot')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
  expect(back).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledTimes(1)
  expect(mockPush).not.toHaveBeenCalled()
})

it('honors disabled back and modal-owned safe area', async () => {
  const back = jest.fn()
  await render(<AppHeader title="Title" safeArea={false} onBack={back} backDisabled />)
  expect(flat(screen.getByTestId('app-header').props.style).paddingTop).toBe(0)
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.back') }))
  expect(back).not.toHaveBeenCalled()
})

it('keeps the shared subtitle 4pt below the title and centers the group with the actions', async () => {
  await render(<AppHeader title="Title" subtitle="Area" onBack={jest.fn()} />)
  const identity = screen.getByText('Area').parent!
  expect(flat(identity.props.style).gap).toBe(4)
  expect(flat(screen.getByText('Area').props.style).marginTop ?? 0).toBe(0)
  expect(flat(identity.parent!.props.style).alignItems).toBe('center')
})

it('keeps the discovery area compact with a 44pt touch target inside the centered header', async () => {
  const chooseArea = jest.fn()
  await render(<AppHeader title="Title" onBack={jest.fn()} titleAccessoryInteractive titleAccessory={<Pressable accessibilityLabel="Choose area" onPress={chooseArea} style={searchStyles.scope} hitSlop={scopeHitSlop}><View style={{ height: spacing[4] }} /></Pressable>} />)
  const area = screen.getByLabelText('Choose area')
  const identity = area.parent!
  expect(flat(identity.props.style)).toMatchObject({ gap: 4, paddingVertical: 16 })
  expect(flat(identity.parent!.props.style).alignItems).toBe('center')
  const rowStyle = flat(area.props.style)
  expect(rowStyle.flex).toBeUndefined()
  expect(rowStyle.minHeight).toBe(16)
  expect(Number(rowStyle.minHeight) + area.props.hitSlop.top + area.props.hitSlop.bottom).toBe(44)
  // RN clips hitSlop at parent bounds; both extensions fit inside identity padding.
  expect(Number(flat(identity.props.style).paddingVertical)).toBeGreaterThanOrEqual(area.props.hitSlop.bottom)
  await fireEvent.press(area)
  expect(chooseArea).toHaveBeenCalledTimes(1)
})
