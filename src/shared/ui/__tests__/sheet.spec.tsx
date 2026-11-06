import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet, Text } from 'react-native'

import '@/shared/i18n'
import { Sheet } from '@/shared/ui/sheet.view'

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
