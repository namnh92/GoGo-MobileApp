import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import '@/shared/i18n'
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
