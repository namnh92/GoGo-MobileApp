import { render, screen } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import * as unistyles from 'react-native-unistyles'

import { PrimaryBtn } from '../button.view'
import { Icon, IconCheck } from '../icons'
import { Text, resolveColor } from '../text'
import { themes } from '../theme'

type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function fills(node: HostNode): unknown[] {
  return [node.props.fill, ...(node.children ?? []).flatMap(child => typeof child === 'string' ? [] : fills(child))]
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(foreground: string, background: string) {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (hi! + 0.05) / (lo! + 0.05)
}

// The stock Unistyles mock always serves orange. Supply each real theme to
// exercise foreground resolution; this does not simulate native theme updates.
describe.each(Object.entries(themes))('%s accent foreground', (_name, theme) => {
  afterEach(() => jest.restoreAllMocks())

  it('supplies readable text, SVG strokes, material icons and loading indicators on accent fills', async () => {
    const runtime = unistyles.useUnistyles().rt
    jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme, rt: runtime })
    const foreground = resolveColor(theme, 'accent.onAccent')
    expect(foreground).toMatch(/^#[0-9A-F]{6}$/i)
    for (const fill of [theme.accent.primary, theme.accent.pressed]) {
      expect(contrast(foreground, fill)).toBeGreaterThanOrEqual(4.5)
    }

    const view = await render(<>
      <Text color="accent.onAccent">Preview action</Text>
      <Icon name="arrowRight" color="accent.onAccent" />
      <IconCheck color={theme.accent.onAccent} />
      <PrimaryBtn variant="pill" label="Apply theme" leadingIcon="checkCircle" onPress={jest.fn()} />
      <PrimaryBtn variant="pill" label="Open system settings" leadingIcon="external" onPress={jest.fn()} />
    </>)
    for (const label of ['Preview action', 'Apply theme', 'Open system settings']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style).color).toBe(foreground)
    }
    for (const glyph of ['icon-arrow-right', 'icon-check']) {
      expect(screen.getByTestId(glyph).props.stroke).toBe(foreground)
    }
    for (const glyph of ['material-icon-checkCircle', 'material-icon-external']) {
      const node = screen.getByTestId(glyph, { includeHiddenElements: true })
      expect(fills(node as unknown as HostNode)).toContainEqual({ type: 0, payload: processColor(foreground) })
    }

    await view.rerender(<PrimaryBtn variant="pill" label="Apply theme" loading onPress={jest.fn()} />)
    expect(StyleSheet.flatten(screen.getByText('Apply theme').props.style).color).toBe(foreground)
    expect(screen.getByTestId('button-spinner').props.color).toBe(foreground)
  })
})
