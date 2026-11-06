import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import i18n from '@/shared/i18n'
import { BackHeader } from '../primitives'
import { themes } from '../theme'

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>

it.each(['auth.signInTab', 'auth.signUpTab'] as const)('groups the %s title beside its 44-point back target', async key => {
  const onBack = jest.fn()
  const title = i18n.t(key)
  await render(<BackHeader redesign title={title} onBack={onBack} right={<View testID="right-avatar" />} />)
  const label = screen.getByText(title)
  const button = screen.getByRole('button', { name: i18n.t('common.back') })
  expect(flat(label.props.style).textAlign).toBe('left')
  expect(label.parent).toBe(button.parent)
  const group = button.parent!
  expect(flat(group.props.style)).toMatchObject({ flexDirection: 'row', flex: 1, minWidth: 0, gap: 8 })
  expect(flat(button.props.style)).toMatchObject({ width: 44, height: 44, marginLeft: -8 })
  const header = group.parent!
  expect(screen.getByTestId('right-avatar').parent).toBe(header)
  // S-04: the fixed header must hide content passing behind its frosted layer.
  expect(flat(header.props.style).backgroundColor).toBe(themes.orange.redesign.canvas)
  expect(flat(header.props.style).opacity ?? 1).toBe(1)
  expect(flat(header.props.style)).toMatchObject({ minHeight: 56, paddingHorizontal: 16, paddingVertical: 0, gap: 8 })
  // Stitch baseline: 16pt inset - 8pt button margin + 44pt target + 8pt gap.
  expect(16 - 8 + 44 + 8).toBe(60)
  await fireEvent.press(button)
  expect(onBack).toHaveBeenCalledTimes(1)
})

it('allows an enlarged redesign title and header to grow within the available row', async () => {
  const title = 'Một tiêu đề dài có thể xuống nhiều dòng trên điện thoại nhỏ'
  await render(<BackHeader redesign title={title} onBack={jest.fn()} right={<View testID="growth-right" />} />)
  const label = screen.getByText(title)
  const button = screen.getByRole('button', { name: i18n.t('common.back') })
  const header = screen.getByTestId('growth-right').parent!
  expect(flat(header.props.style).height).toBeUndefined()
  expect(flat(header.props.style).minHeight).toBe(56)
  expect(flat(label.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0, textAlign: 'left' })
  expect(flat(label.props.style).marginHorizontal).toBeUndefined()
  expect(label.props.numberOfLines).toBeUndefined()
  expect(label.props.allowFontScaling).not.toBe(false)
  expect(flat(button.props.style).flexShrink).toBe(0)
})

it('preserves the default centered title, button surface, right fallback and callback', async () => {
  const onBack = jest.fn()
  await render(<BackHeader title="Tiêu đề" onBack={onBack} />)
  const label = screen.getByText('Tiêu đề')
  const button = screen.getByRole('button', { name: i18n.t('common.back') })
  const header = button.parent!
  expect(label.parent).toBe(header)
  expect(flat(label.props.style)).toMatchObject({ textAlign: 'center', marginHorizontal: 8, flexShrink: 1 })
  expect(flat(button.props.style)).toMatchObject({ width: 36, height: 36, borderWidth: 1 })
  expect(flat(button.props.style).marginLeft).toBeUndefined()
  expect(flat(header.props.style)).toMatchObject({ paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'space-between' })
  expect(flat(header.props.style).minHeight).toBeUndefined()
  expect(flat(header.props.style).backgroundColor).toBeUndefined()
  const spacer = header.children[header.children.length - 1]
  expect(typeof spacer === 'object' ? flat(spacer.props.style).width : spacer).toBe(36)
  await fireEvent.press(button)
  expect(onBack).toHaveBeenCalledTimes(1)
})

it.each([false, true])('preserves subtitle and supplied right content (redesign=%s)', async redesign => {
  await render(<BackHeader redesign={redesign} title="Tiêu đề" subtitle="Chú thích" onBack={jest.fn()} right={<View testID="right-content" />} />)
  const label = screen.getByText('Tiêu đề')
  const subtitle = screen.getByText('Chú thích')
  expect(label.parent).toBe(subtitle.parent)
  expect(flat(label.parent!.props.style)).toMatchObject({ flex: 1, marginHorizontal: 12 })
  expect(label.props.numberOfLines).toBe(1)
  expect(subtitle.props.numberOfLines).toBe(1)
  expect(screen.getByTestId('right-content').parent).toBe(screen.getByRole('button').parent)
})

it.each([false, true])('preserves the no-title right fallback (redesign=%s)', async redesign => {
  await render(<BackHeader redesign={redesign} onBack={jest.fn()} />)
  const header = screen.getByRole('button').parent!
  const spacer = header.children[header.children.length - 1]
  expect(typeof spacer === 'object' ? flat(spacer.props.style).width : spacer).toBe(36)
})
