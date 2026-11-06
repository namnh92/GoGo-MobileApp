import { render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '../theme'

UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })
const { Badge } = jest.requireActual<typeof import('../badge.view')>('../badge.view')
const { PasswordRequirements } = jest.requireActual<typeof import('../password-requirements.view')>('../password-requirements.view')
type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function fills(node: HostNode): unknown[] {
  return [(node.props.fill as { payload?: number } | undefined)?.payload,
    ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : fills(child))].filter(value => value !== undefined)
}
it('Dark checklist resolves text and SVG against the Dark theme', async () => {
  await render(<PasswordRequirements value="" />)
  const row = screen.getByTestId('password-requirement-length')
  const label = within(row).getByText('Ít nhất 8 ký tự')
  expect(StyleSheet.flatten(label.props.style).color).toBe(themes.orangeDark.redesign.outline)
  expect(fills(row)).toContain(processColor(themes.orangeDark.redesign.outline))
})
it('Dark recommendation binds opaque scoped fill and white label/SVG', async () => {
  await render(<Badge appearance="stitchGreen" icon="verified" label="Gợi ý" />)
  const label = screen.getByText('Gợi ý')
  expect(StyleSheet.flatten(label.props.style).color).toBe('#FFFFFF')
  expect(fills(label.parent!)).toContain(processColor('#FFFFFF'))
  expect(StyleSheet.flatten(label.parent!.props.style).backgroundColor).toBe('#3B8365')
  expect(StyleSheet.flatten(label.parent!.props.style).opacity).toBeUndefined()
})
