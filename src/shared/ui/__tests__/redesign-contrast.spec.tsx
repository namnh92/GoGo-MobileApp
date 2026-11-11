import { render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import '@/shared/i18n'
import { themes } from '../theme'
import { Badge } from '../badge.view'
import { PasswordRequirements } from '../password-requirements.view'

type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function fills(node: HostNode): unknown[] {
  return [(node.props.fill as { payload?: number } | undefined)?.payload,
    ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : fills(child))].filter(value => value !== undefined)
}
it('Light checklist binds the same opaque scoped colour to text and SVG', async () => {
  await render(<PasswordRequirements value="" />)
  const row = screen.getByTestId('password-requirement-length')
  const label = within(row).getByText('Ít nhất 8 ký tự')
  expect(StyleSheet.flatten(label.props.style).color).toBe('#8A6C66')
  expect(fills(row)).toContain(processColor('#8A6C66'))
  expect(StyleSheet.flatten(row.props.style).opacity).toBeUndefined()
})
it('Light recommendation retains white label and SVG on the scoped fill', async () => {
  await render(<Badge appearance="stitchGreen" icon="verified" label="Gợi ý" />)
  const label = screen.getByText('Gợi ý')
  expect(StyleSheet.flatten(label.props.style).color).toBe(themes.orange.text.inverse)
  expect(fills(label.parent!)).toContain(processColor(themes.orange.text.inverse))
  expect(StyleSheet.flatten(label.parent!.props.style)).toMatchObject({ backgroundColor: '#237C51' })
  expect(StyleSheet.flatten(label.parent!.props.style).opacity).toBeUndefined()
})
