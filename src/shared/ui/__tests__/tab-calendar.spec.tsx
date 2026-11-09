import { render, screen } from '@testing-library/react-native'
import { processColor } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { IconCalendar, IconHome } from '../icons'
import { themes, type ThemeName } from '../theme'

type Node = { props: Record<string, any>; children?: (Node | string)[] }
function descendants(node: Node): Node[] {
  return (node.children ?? []).flatMap(child => typeof child === 'string' ? [] : [child, ...descendants(child)])
}
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map(i => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i]!, 0)
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe.each(Object.keys(themes) as ThemeName[])('tab calendar in %s (#575)', name => {
  it.each([false, true])('keeps the 22pt calendar legible with active=%s', async active => {
    const theme = themes[name]
    StyleSheet.configure({ themes: { [name]: theme } as typeof themes })
    await render(<><IconCalendar active={active} /><IconHome active /></>)
    const icon = screen.getByTestId(`icon-calendar${active ? '-filled' : ''}`)
    const tint = active ? theme.accent.text : theme.text.secondary
    expect(icon.props).toMatchObject({ width: 22, height: 22, stroke: tint, fill: active ? tint : 'none', strokeWidth: 1.8 })
    expect(contrast(tint, theme.surface.card)).toBeGreaterThanOrEqual(3)
    const shapes = descendants(icon as unknown as Node)
    const dots = shapes.filter(node => node.props.cx !== undefined)
    if (active) {
      // Four large, separated date cut-outs survive the solid fill at tab size.
      expect(dots.map(({ props }) => [Number(props.cx), Number(props.cy), Number(props.r)])).toEqual([
        [8, 14, 1.25], [16, 14, 1.25], [8, 18, 1.25], [16, 18, 1.25],
      ])
      for (const dot of dots) expect(dot.props.fill.payload).toBe(processColor(theme.surface.card))
      // SVG Line is emitted as a native path by react-native-svg.
      const detailStrokes = shapes.filter(node => node.props.stroke?.payload === processColor(theme.surface.card))
      expect(detailStrokes).toHaveLength(1)
      expect(contrast(theme.surface.card, tint)).toBeGreaterThanOrEqual(3)
      // Home's door and the calendar details share the same active-style helper.
      const home = descendants(screen.getByTestId('icon-home-filled') as unknown as Node)
      expect(home.some(node => node.props.stroke?.payload === processColor(theme.surface.card))).toBe(true)
    } else {
      expect(dots).toHaveLength(0)
      expect(shapes.some(node => node.props.stroke?.payload === processColor(theme.surface.card))).toBe(false)
    }
  })
})
