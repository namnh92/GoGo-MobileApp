import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import i18n from '@/shared/i18n'
import { PrimaryBtn, SecondaryBtn } from '../button.view'
import { SheetActions } from '../sheet-actions.view'
import { MediaPermissionSheet } from '@/shared/media/media-permission-sheet.view'

it.each([2, 3])('keeps %i equal-width actions on one non-wrapping row with single-line labels', async count => {
  await render(<SheetActions>
    <SecondaryBtn label="Cancel" onPress={jest.fn()} style={{ flex: 2 }} />
    {count === 3 ? <SecondaryBtn label="Other" onPress={jest.fn()} /> : null}
    <PrimaryBtn variant="stitch" label="A long primary command" onPress={jest.fn()} wrapLabel />
  </SheetActions>)
  expect(StyleSheet.flatten(screen.getByTestId('sheet-actions').props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(count)
  for (const button of buttons) expect(StyleSheet.flatten(button.props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0 })
  expect(screen.getByText('A long primary command').props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' })
  expect(buttons[0]!.props.accessibilityLabel).toBe('Cancel')
})

it.each([
  ['camera', 'denied'], ['camera', 'unavailable'], ['library', 'denied'], ['library', 'unavailable'],
] as const)('orders %s %s recovery cancel, fallback, primary and retains callbacks', async (source, status) => {
  const close = jest.fn(), choose = jest.fn(), settings = jest.fn()
  await render(<MediaPermissionSheet issue={{ source, status }} onClose={close} onChoose={choose} onSettings={settings} onClosed={jest.fn()} />)
  const row = within(screen.getByTestId('sheet-actions'))
  const buttons = row.getAllByRole('button')
  expect(buttons).toHaveLength(status === 'denied' ? 3 : 2)
  expect(buttons[0]!.props.accessibilityLabel).toBe(i18n.t('common.cancel'))
  const fallback = source === 'camera' ? 'library' : 'camera'
  const fallbackButton = row.getByRole('button', { name: i18n.t(fallback === 'library' ? 'mediaPermission.libraryAction' : 'mediaPermission.cameraAction') })
  await fireEvent.press(fallbackButton)
  expect(choose).toHaveBeenCalledWith(fallback)
  if (status === 'denied') {
    expect(buttons[2]!.props.accessibilityLabel).toBe(i18n.t('account.avatarSettings'))
    await fireEvent.press(buttons[2]!)
    expect(settings).toHaveBeenCalledTimes(1)
  }
  await fireEvent.press(buttons[0]!)
  expect(close).toHaveBeenCalledTimes(1)
})
