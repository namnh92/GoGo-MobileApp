import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { SegmentedControl } from '../segmented-control.view'
import { styles as authStyles } from '@/features/auth/sign-in.style'

const options = [{ value: 'login', label: 'Đăng nhập' }, { value: 'register', label: 'Đăng ký' }] as const
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, number | string | undefined>
it('gives each actual tab a 44-point target with selection and callbacks on that target', async () => {
  const onChange = jest.fn()
  await render(<SegmentedControl options={options} value="login" onChange={onChange} />)
  for (const tab of screen.getAllByRole('tab')) {
    expect(flat(tab.props.style).minHeight).toBeGreaterThanOrEqual(44)
    expect(flat(tab.props.style).minWidth).toBeGreaterThanOrEqual(44)
  }
  expect(screen.getByRole('tab', { name: 'Đăng nhập' }).props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('tab', { name: 'Đăng ký' }).props.accessibilityState.selected).toBe(false)
  await fireEvent.press(screen.getByRole('tab', { name: 'Đăng ký' }))
  expect(onChange).toHaveBeenCalledWith('register')
})
it('keeps disabled semantics and prevents callbacks on the outer tabs', async () => {
  const onChange = jest.fn()
  await render(<SegmentedControl options={options} value="login" onChange={onChange} disabled />)
  for (const tab of screen.getAllByRole('tab')) {
    expect(tab).toBeDisabled()
    await fireEvent.press(tab)
  }
  expect(onChange).not.toHaveBeenCalled()
})
it('retains the 42-point rail and 34-point surfaces with content-driven growth and compensated spacing', async () => {
  await render(<SegmentedControl options={options} value="login" onChange={jest.fn()} />)
  const target = screen.getByRole('tab', { name: 'Đăng nhập' })
  const surface = screen.getByText('Đăng nhập').parent!
  const outer = flat(target.props.style)
  const inner = flat(surface.props.style)
  const rail = flat(screen.getByTestId('segmented-rail').props.style)
  expect(inner.minHeight).toBe(34)
  expect(outer.paddingVertical).toBe(5)
  expect(Number(outer.minHeight) - Number(rail.top) - Number(rail.bottom)).toBe(42)
  expect(inner.height).toBeUndefined()
  expect(outer.height).toBeUndefined()
  expect(flat(target.parent!.props.style).height).toBeUndefined()
  expect(flat(target.parent!.props.style).paddingHorizontal).toBe(4)
  // At enlarged line height the inner surface and target both grow, preserving the inset.
  expect(inner.paddingVertical).toBe(8)
  expect(inner.alignSelf).toBe('stretch')
  expect(inner.flexGrow).toBe(1)
  expect(inner.backgroundColor).toBeTruthy()
  expect(flat(authStyles.tabs)).toMatchObject({ marginTop: 11, marginBottom: 23 })
})

it('compact icon tabs retain selection, disabled semantics and 44pt targets', async () => {
  const onChange = jest.fn()
  await render(<SegmentedControl compact options={[{ value: 'list', label: 'Danh sách', icon: 'list' }, { value: 'map', label: 'Bản đồ', icon: 'map' }]} value="list" onChange={onChange} />)
  const map = screen.getByRole('tab', { name: 'Bản đồ' })
  expect(flat(map.props.style).flex).toBe(0)
  expect(flat(map.parent!.props.style)).toMatchObject({ flexShrink: 0, alignSelf: 'flex-start' })
  expect(flat(screen.getByText('Bản đồ').parent!.props.style)).toMatchObject({ minHeight: 28, flexGrow: 0 })
  expect(screen.getByText('Bản đồ').props.numberOfLines).toBe(1)
  expect(flat(screen.getByTestId('segmented-rail').props.style)).toMatchObject({ top: 8, bottom: 8 })
  expect(flat(map.props.style).minHeight).toBeGreaterThanOrEqual(44)
  await fireEvent.press(map)
  expect(onChange).toHaveBeenCalledWith('map')
})
