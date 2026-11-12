import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import i18n from '@/shared/i18n'
import { buttonSizes, status } from '../tokens'
import { ResultSheet } from '../result-sheet.view'

it.each(['success', 'error', 'warning', 'info'] as const)('renders %s with optional note/actions and closes through the shared Sheet', async variant => {
  const primary = jest.fn(), secondary = jest.fn(), close = jest.fn(), closed = jest.fn()
  await render(<ResultSheet visible variant={variant} title="Result title" body="Result body" note="Small note"
    primaryAction={{ label: 'Continue', onPress: primary }} secondaryAction={{ label: 'Save', onPress: secondary }} onClose={close} onClosed={closed} />)
  expect(screen.getByRole('header', { name: 'Result title' })).toBeTruthy()
  expect(screen.getByText('Small note')).toBeTruthy()
  await fireEvent.press(screen.getByText('Continue'))
  await fireEvent.press(screen.getByText('Save'))
  await fireEvent.press(screen.getByLabelText('Đóng'))
  expect(primary).toHaveBeenCalledTimes(1)
  expect(secondary).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledTimes(1)
  await fireEvent(screen.getByTestId('result-sheet-modal', { includeHiddenElements: true }), 'dismiss')
  expect(closed).toHaveBeenCalledTimes(1)
})
it('announces the result and cancels pending announcements on close', async () => {
  jest.useFakeTimers()
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  const props = { variant: 'success' as const, title: 'Sent', body: 'Review pending', primaryAction: { label: 'Continue', onPress: jest.fn() }, onClose: jest.fn() }
  const view = await render(<ResultSheet visible {...props} />)
  await fireEvent(screen.getByRole('header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 30 } } })
  await act(async () => { jest.advanceTimersByTime(300) })
  expect(announce).toHaveBeenCalledWith('Sent. Review pending')
  announce.mockClear()
  await fireEvent(screen.getByRole('header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 30 } } })
  await view.rerender(<ResultSheet visible={false} {...props} />)
  await act(async () => { jest.advanceTimersByTime(300) })
  expect(announce).not.toHaveBeenCalled()
  announce.mockRestore()
  jest.useRealTimers()
})

it('renders arbitrary media before the message and equal-width actions on one line', async () => {
  await render(<ResultSheet visible variant="success" title="Sent" body="Review pending"
    media={<View testID="custom-media"><Text>Custom context</Text></View>}
    primaryAction={{ label: 'View contributions', onPress: jest.fn() }}
    secondaryAction={{ label: 'Add another', onPress: jest.fn() }} onClose={jest.fn()} />)
  const media = screen.getByTestId('custom-media')
  const body = screen.getByText('Review pending')
  expect(media.parent).toBe(screen.getByTestId('result-sheet-media'))
  expect(StyleSheet.flatten(media.parent!.props.style)).toMatchObject({ width: '100%', marginVertical: -8 })
  expect(body.parent!.children.indexOf(media.parent!)).toBeLessThan(body.parent!.children.indexOf(body))
  const primary = screen.getByRole('button', { name: 'View contributions' })
  const secondary = screen.getByRole('button', { name: 'Add another' })
  expect(primary.parent).toBe(secondary.parent)
  expect(StyleSheet.flatten(primary.parent!.props.style).flexDirection).toBe('row')
  for (const action of [primary, secondary]) expect(StyleSheet.flatten(action.props.style)).toMatchObject({ flex: 1, minWidth: 0, minHeight: buttonSizes.regular.minHeight })
  expect(screen.getByText('View contributions').props.numberOfLines).toBe(1)
})


it('offers secondary cancel first and a danger confirmation while preserving shared action states', async () => {
  const confirm = jest.fn(), cancel = jest.fn()
  await render(<ResultSheet visible variant="warning" title="Confirm?" body="This ends the session."
    primaryAction={{ label: 'Confirm', onPress: confirm, destructive: true, loading: true }}
    secondaryAction={{ label: 'Cancel', onPress: cancel }} onClose={cancel} />)
  const primary = screen.getByRole('button', { name: 'Confirm' })
  const secondary = screen.getByRole('button', { name: 'Cancel' })
  expect(StyleSheet.flatten(primary.props.style)).toMatchObject({ borderWidth: 0, backgroundColor: status.dangerSoft })
  expect(primary.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  expect(primary.parent).toBe(secondary.parent)
  expect(primary.parent!.children.indexOf(secondary)).toBeLessThan(primary.parent!.children.indexOf(primary))
  await fireEvent.press(primary)
  expect(confirm).not.toHaveBeenCalled()
  await fireEvent.press(secondary)
  expect(cancel).toHaveBeenCalledTimes(1)
})


// Audited all ResultSheet callers, including import cleanup/unconfirmed branches.
// Conservative copy budget for the paired actions at 390pt; native font layout
// and larger accessibility sizes require device acceptance.
it.each(['vi', 'en'])('keeps every result action concise and both import actions on one row (%s)', async lng => {
  const keys = [
    'placeResult.viewContributions', 'placeResult.addAnother',
    'placeWizard.lifecycle.checkContributions', 'placeWizard.lifecycle.retryCleanup',
    'placeWizard.save', 'common.retry', 'common.close', 'common.cancel',
    'auth.signInCta', 'g11.logoutConfirm', 'account.deleteAction', 'account.deleteCancel',
  ]
  for (const key of keys) {
    const label = i18n.t(key, { lng })
    expect(label).not.toBe(key)
    expect(label).not.toMatch(/…|\.\.\./)
    expect([...label].length).toBeLessThanOrEqual(13)
  }
  await render(<ResultSheet visible variant="success" title="Sent" body="Review pending"
    primaryAction={{ label: i18n.t('placeResult.viewContributions', { lng }), onPress: jest.fn() }}
    secondaryAction={{ label: i18n.t('placeResult.addAnother', { lng }), onPress: jest.fn() }} onClose={jest.fn()} />)
  const actions = ['placeResult.viewContributions', 'placeResult.addAnother'].map(key => screen.getByRole('button', { name: i18n.t(key, { lng }) }))
  expect(actions[0].parent).toBe(actions[1].parent)
  expect(StyleSheet.flatten(actions[0].parent!.props.style).flexDirection).toBe('row')
  for (const key of ['placeResult.viewContributions', 'placeResult.addAnother']) expect(screen.getByText(i18n.t(key, { lng })).props.numberOfLines).toBe(1)
})

it('embeds the shared warning in an existing sheet without creating another native Modal', async () => {
  const props = { embedded: true, variant: 'warning' as const, title: 'Confirm?', body: 'Changes make plans stale.',
    primaryAction: { label: 'Confirm', onPress: jest.fn() }, secondaryAction: { label: 'Cancel', onPress: jest.fn() }, onClose: jest.fn() }
  const view = await render(<ResultSheet visible {...props} />)
  expect(screen.getByTestId('result-sheet')).toBeTruthy()
  expect(screen.queryByTestId('result-sheet-modal', { includeHiddenElements: true })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
  expect(props.secondaryAction.onPress).toHaveBeenCalledTimes(1)
  await view.rerender(<ResultSheet visible={false} {...props} />)
  expect(screen.queryByTestId('result-sheet')).toBeNull()
})
