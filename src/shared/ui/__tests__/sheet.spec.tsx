import { Gesture, State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, Text } from 'react-native'
import { withTiming } from 'react-native-reanimated'
import { useState } from 'react'

import '@/shared/i18n'
import { Sheet } from '@/shared/ui/sheet.view'
import { TextInput } from '@/shared/ui/text-input'
import { motion } from '@/shared/ui/tokens'

// Keep the Jest animation driver, recording timing calls without replacing
// completion with a synchronous callback (which would hide early unmounts).
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return { __esModule: true, ...actual, withTiming: jest.fn(actual.withTiming) }
})

/** GoGo-MobileApp#381 — the shared bottom sheet. */

type Instance = ReturnType<typeof screen.getByText>

function translateYs(node: Instance): number[] {
  const out: number[] = []
  for (let current = node.parent; current; current = current.parent) {
    const transform = (StyleSheet.flatten(current.props.style) as { transform?: Record<string, number>[] } | undefined)?.transform
    for (const step of transform ?? []) if (typeof step.translateY === 'number' && step.translateY !== 0) out.push(step.translateY)
  }
  return out
}

async function settle(reduced: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced)
}

afterEach(() => jest.restoreAllMocks())

it('names its backdrop "Đóng" and closes from it', async () => {
  const onClose = jest.fn()
  await render(<Sheet visible onClose={onClose}><Text>Nội dung</Text></Sheet>)
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }))
  })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('renders nothing while closed', async () => {
  await render(<Sheet visible={false} onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  expect(screen.queryByText('Nội dung', { includeHiddenElements: true })).toBeNull()
})

it('with reduced motion, appears in place and goes at once', async () => {
  await settle(true)
  const view = await render(<Sheet visible onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  await act(async () => {})
  expect(translateYs(screen.getByText('Nội dung'))).toEqual([])
  await act(async () => {
    await view.rerender(<Sheet visible={false} onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  })
  expect(screen.queryByText('Nội dung', { includeHiddenElements: true })).toBeNull()
})

it('without reduced motion, slides out — hidden from touch and screen readers at once, gone after', async () => {
  await settle(false)
  const view = await render(<Sheet visible onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  await act(async () => {})
  await act(async () => {
    await view.rerender(<Sheet visible={false} onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  })
  expect(screen.queryByText('Nội dung')).toBeNull()
  await waitFor(() => expect(screen.queryByText('Nội dung', { includeHiddenElements: true })).toBeNull())
})

it('pads the safe area only while the keyboard is down', async () => {
  await render(<Sheet visible onClose={jest.fn()}><Text>Nội dung</Text></Sheet>)
  // jest's safe-area mock reports a 34pt bottom inset; spacing[5] is 20.
  const padded = (node: Instance | null): number[] => {
    const out: number[] = []
    for (let current = node; current; current = current.parent) {
      const style = StyleSheet.flatten(current.props.contentContainerStyle) as { paddingBottom?: number } | undefined
      if (style?.paddingBottom != null) out.push(style.paddingBottom)
    }
    return out
  }
  expect(padded(screen.getByText('Nội dung'))).toContain(54)
})

it('keeps optional header and footer outside the scrolling body and supports non-scrolling consumers', async () => {
  const view = await render(<Sheet visible onClose={jest.fn()} header={<Text>Header</Text>} footer={<Text>Footer</Text>}><Text>Body</Text></Sheet>)
  const scrollAncestor = (label: string) => {
    let node = screen.getByText(label).parent
    while (node) { if (String(node.type).includes('ScrollView')) return true; node = node.parent }
    return false
  }
  expect(scrollAncestor('Body')).toBe(true)
  expect(scrollAncestor('Header')).toBe(false)
  expect(scrollAncestor('Footer')).toBe(false)
  await view.rerender(<Sheet visible onClose={jest.fn()} scroll={false}><Text>Custom list</Text></Sheet>)
  expect(screen.getByText('Custom list')).toBeTruthy()
  expect(screen.queryByText('Header')).toBeNull()
})


it('dismisses an opted-in sheet with a downward swipe on its handle', async () => {
  const onClose = jest.fn()
  await render(<Sheet swipeToClose visible onClose={onClose}><Text>Area picker</Text></Sheet>)
  expect(screen.getByTestId('sheet-drag-handle')).toBeTruthy()
  await act(async () => {
    fireGestureHandler<ReturnType<typeof Gesture.Pan>>(getByGestureTestId('sheet-dismiss'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: 80, velocityY: 100 },
      { state: State.END, translationY: 100, velocityY: 100 },
    ])
  })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('F-15 preserves input touches, long presses and selection while dismissing the keyboard only on drag', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss')
  const blur = jest.fn()
  const selection = jest.fn()
  await render(<Sheet visible onClose={jest.fn()}>
    <TextInput accessibilityLabel="Edit amount" defaultValue="100000" onBlur={blur} onSelectionChange={selection} />
  </Sheet>)
  const input = screen.getByLabelText('Edit amount')
  await fireEvent(input, 'focus')
  await fireEvent(input, 'touchStart', { nativeEvent: { target: input } })
  await fireEvent(input, 'longPress')
  await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 1, end: 4 } } })
  expect(selection).toHaveBeenCalledWith(expect.objectContaining({ nativeEvent: { selection: { start: 1, end: 4 } } }))
  expect(dismiss).not.toHaveBeenCalled()
  expect(blur).not.toHaveBeenCalled()
  // Native ScrollView owns drag dismissal; Jest cannot execute the native keyboard.
  let scroll = input.parent
  while (scroll && scroll.props.keyboardShouldPersistTaps === undefined) scroll = scroll.parent
  expect(scroll?.props.keyboardDismissMode).toBe('on-drag')
})

describe('R12 shared sheet motion', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
    jest.mocked(withTiming).mockClear()
    await settle(false)
  })
  afterEach(() => jest.useRealTimers())

  const advance = async (ms = motion.standard + 100) => {
    await act(async () => { jest.advanceTimersByTime(ms) })
  }
  // Read the driver's current values directly: Reanimated 4's getAnimatedStyle
  // cannot flatten RN's valid `false` entries in conditional style arrays.
  const panelStyle = () => screen.getByTestId('motion-sheet', { includeHiddenElements: true }).props.jestAnimatedStyle.value as { transform: { translateY: number }[] }
  const opacity = () => (screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }).props.jestAnimatedStyle.value as { opacity: number }).opacity
  const content = (visible: boolean, onClosed = jest.fn()) => <Sheet visible={visible} onClose={jest.fn()} onClosed={onClosed} testID="motion-sheet"><Text>Motion body</Text></Sheet>

  it.each([true, false])('slides up and fades in, including initially visible=%s', async initiallyVisible => {
    const view = await render(content(initiallyVisible))
    if (!initiallyVisible) await view.rerender(content(true))
    expect(motion.standard).toBeGreaterThanOrEqual(150)
    expect(motion.standard).toBeLessThanOrEqual(300)
    expect(withTiming).toHaveBeenCalledWith(1, { duration: motion.standard })
    expect(panelStyle().transform[0].translateY).toBeGreaterThan(0)
    expect(opacity()).toBe(0)
    await advance(motion.standard / 2)
    expect(opacity()).toBeGreaterThan(0)
    expect(opacity()).toBeLessThan(1)
    expect(panelStyle().transform[0].translateY).toBeGreaterThan(0)
    await advance()
    expect(opacity()).toBe(1)
    expect(panelStyle().transform[0].translateY).toBe(0)
  })

  it('programmatic close blocks interaction immediately and unmounts only after completion', async () => {
    const onClosed = jest.fn()
    const view = await render(content(true, onClosed))
    await advance()
    await view.rerender(content(false, onClosed))
    expect(withTiming).toHaveBeenLastCalledWith(0, { duration: motion.standard }, expect.any(Function))
    expect(screen.queryByText('Motion body')).toBeNull()
    const body = screen.getByText('Motion body', { includeHiddenElements: true })
    let root = body.parent
    while (root && root.props.pointerEvents !== 'none') root = root.parent
    expect(root?.props.accessibilityElementsHidden).toBe(true)
    expect(onClosed).not.toHaveBeenCalled()
    await advance(motion.standard / 2)
    expect(opacity()).toBeGreaterThan(0)
    expect(opacity()).toBeLessThan(1)
    expect(panelStyle().transform[0].translateY).toBeGreaterThan(0)
    expect(onClosed).not.toHaveBeenCalled()
    await advance()
    expect(screen.queryByText('Motion body', { includeHiddenElements: true })).toBeNull()
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('reduced motion skips the driver on open and close', async () => {
    await settle(true)
    const view = await render(content(true))
    expect(withTiming).not.toHaveBeenCalled()
    expect(translateYs(screen.getByText('Motion body'))).toEqual([])
    await view.rerender(content(false))
    expect(screen.queryByText('Motion body', { includeHiddenElements: true })).toBeNull()
    expect(withTiming).not.toHaveBeenCalled()
  })

  it('reopening cancels an exit without dismissing the reopened sheet', async () => {
    const onClosed = jest.fn()
    const view = await render(content(true, onClosed))
    await advance()
    await view.rerender(content(false, onClosed))
    await advance(motion.standard / 2)
    await view.rerender(content(true, onClosed))
    await advance()
    expect(screen.getByText('Motion body')).toBeTruthy()
    expect(opacity()).toBe(1)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it.each(['backdrop', 'close button', 'swipe', 'Android back', 'accessibility escape'])('%s uses the same exit animation', async method => {
    function ControlledSheet() {
      const [visible, setVisible] = useState(true)
      const close = () => setVisible(false)
      return <Sheet visible={visible} onClose={close} swipeToClose testID="motion-sheet"
        header={<Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={close}><Text>Close</Text></Pressable>}>
        <Text>Motion body</Text>
      </Sheet>
    }
    await render(<ControlledSheet />)
    await advance()
    if (method === 'backdrop') await fireEvent.press(screen.getByRole('button', { name: 'Đóng' }))
    if (method === 'close button') await fireEvent.press(screen.getByRole('button', { name: 'Close sheet' }))
    if (method === 'Android back') {
      let modal = screen.getByText('Motion body').parent
      while (modal && modal.type !== 'Modal') modal = modal.parent
      if (!modal) throw new Error('Sheet modal missing')
      await fireEvent(modal, 'requestClose')
    }
    if (method === 'accessibility escape') await fireEvent(screen.getByTestId('motion-sheet'), 'accessibilityEscape')
    if (method === 'swipe') await act(async () => {
      fireGestureHandler<ReturnType<typeof Gesture.Pan>>(getByGestureTestId('sheet-dismiss'), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 80, velocityY: 100 },
        { state: State.END, translationY: 100, velocityY: 100 },
      ])
    })
    expect(withTiming).toHaveBeenLastCalledWith(0, { duration: motion.standard }, expect.any(Function))
    expect(screen.getByText('Motion body', { includeHiddenElements: true })).toBeTruthy()
    await advance()
    expect(screen.queryByText('Motion body', { includeHiddenElements: true })).toBeNull()
  })
})
