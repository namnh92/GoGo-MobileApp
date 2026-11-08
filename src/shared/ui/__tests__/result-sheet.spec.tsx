import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native'
import '@/shared/i18n'
import { status } from '../tokens'
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
  expect(media.parent).toBe(body.parent)
  expect(media.parent!.children.indexOf(media)).toBeLessThan(body.parent!.children.indexOf(body))
  const primary = screen.getByRole('button', { name: 'View contributions' })
  const secondary = screen.getByRole('button', { name: 'Add another' })
  expect(primary.parent).toBe(secondary.parent)
  expect(StyleSheet.flatten(primary.parent!.props.style).flexDirection).toBe('row')
  for (const action of [primary, secondary]) expect(StyleSheet.flatten(action.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
  expect(screen.getByText('View contributions').props.numberOfLines).toBeUndefined()
})


it('offers secondary cancel first and a danger confirmation while preserving shared action states', async () => {
  const confirm = jest.fn(), cancel = jest.fn()
  await render(<ResultSheet visible variant="warning" title="Confirm?" body="This ends the session."
    actionOrder="secondary-first" primaryAction={{ label: 'Confirm', onPress: confirm, destructive: true, loading: true }}
    secondaryAction={{ label: 'Cancel', onPress: cancel }} onClose={cancel} />)
  const primary = screen.getByRole('button', { name: 'Confirm' })
  const secondary = screen.getByRole('button', { name: 'Cancel' })
  expect(StyleSheet.flatten(primary.props.style).borderColor).toBe(status.danger)
  expect(primary.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  expect(primary.parent).toBe(secondary.parent)
  expect(primary.parent!.children.indexOf(secondary)).toBeLessThan(primary.parent!.children.indexOf(primary))
  await fireEvent.press(primary)
  expect(confirm).not.toHaveBeenCalled()
  await fireEvent.press(secondary)
  expect(cancel).toHaveBeenCalledTimes(1)
})
