import { render, screen } from '@testing-library/react-native'
import { processColor } from 'react-native'

import * as icons from '@/shared/ui/icons'
import { accents, surface, text } from '@/shared/ui/tokens'

/**
 * #382 (UI-AI-002 §3). One icon primitive: a 24-unit grid, a 1.8 round
 * stroke, and a colour passed in as a semantic role rather than baked in.
 * The tab icons already drew this way; the rest drew at 2–2.5 in fixed
 * neutrals, and `IconChevronRight` in `neutral[300]` measured 1.8:1 — under
 * the 3:1 a UI glyph needs.
 */
type SvgProps = { stroke?: string; fill?: string; strokeWidth?: number; strokeLinecap?: string; width?: number }
const svg = (testID: string) => screen.getByTestId(testID).props as SvgProps

function luminance(hex: string): number {
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe('Icon primitive (#382)', () => {
  it('draws a 1.8 round stroke in a semantic colour (the 24 grid is checked in design-drift.test.ts)', async () => {
    await render(<icons.Icon name="settings" color="accent.primary" size={18} />)
    expect(svg('icon-settings')).toMatchObject({
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      stroke: accents.orange.text,
      width: 18,
    })
  })

  it('defaults to text.primary — no icon picks a colour of its own', async () => {
    await render(<icons.Icon name="search" />)
    expect(svg('icon-search').stroke).toBe(text.primary)
  })

  it('a filled glyph fills with its own colour', async () => {
    await render(<icons.Icon name="star" filled color="status.warningText" />)
    expect(svg('icon-star-filled')).toMatchObject({ fill: '#8F5F1A', stroke: '#8F5F1A' })
  })
})

describe('named icons draw through the primitive (#382)', () => {
  it('the chevron reads at 3:1 as a UI glyph on a card and on the canvas', async () => {
    await render(<icons.IconChevronRight />)
    const { stroke } = svg('icon-chevron-right')
    expect(stroke).toBe(text.secondary)
    expect(contrast(stroke!, surface.card)).toBeGreaterThanOrEqual(3)
    expect(contrast(stroke!, surface.canvas)).toBeGreaterThanOrEqual(3)
  })

  it.each([
    ['chevron-left', <icons.IconChevronLeft key="a" />],
    ['chevron-right', <icons.IconChevronRight key="b" />],
    ['map-pin', <icons.IconMapPin key="c" />],
    ['clock', <icons.IconClock key="d" />],
    ['dollar', <icons.IconDollar key="e" />],
    ['check', <icons.IconCheck key="f" />],
    ['copy', <icons.IconCopy key="g" />],
    ['share', <icons.IconShare key="h" />],
    ['arrow-right', <icons.IconArrowRight key="i" />],
    ['search', <icons.IconSearch key="j" />],
    ['user-outline', <icons.IconUserOutline key="k" />],
    ['info', <icons.IconInfo key="l" color={text.secondary} />],
  ])('%s: the shared 1.8 round stroke', async (name, element) => {
    await render(element)
    expect(svg(`icon-${name}`)).toMatchObject({ strokeWidth: 1.8, strokeLinecap: 'round' })
  })
})

type HostNode = { props: Record<string, unknown>; children?: (HostNode | string)[] }
function descendants(node: HostNode): HostNode[] {
  return (node.children ?? []).flatMap(child => (typeof child === 'string' ? [] : [child, ...descendants(child)]))
}

describe('GoGo AI glyph (#379)', () => {
  it('the outline assistant icon draws on the shared grid and stroke', async () => {
    await render(<icons.Icon name="assistant" color="text.secondary" />)
    expect(svg('icon-assistant')).toMatchObject({ strokeWidth: 1.8, strokeLinecap: 'round', stroke: text.secondary })
  })

  it('the solid avatar is an accent bubble with the face cut out in onAccent', async () => {
    await render(<icons.AssistantGlyph size={36} />)
    const paths = descendants(screen.getByTestId('assistant-glyph') as unknown as HostNode).map(node => node.props.d)
    expect(paths).toContain('M7 5h10a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9.5L6 21v-3.13A4 4 0 0 1 3 14V9a4 4 0 0 1 4-4z')
  })

  it('inverted for the float button: a white bubble with an accent face', async () => {
    await render(<icons.AssistantGlyph size={30} inverted />)
    // react-native-svg hands the host processed colours: { type: 0, payload: ARGB }.
    const fills = descendants(screen.getByTestId('assistant-glyph-inverted') as unknown as HostNode)
      .map(node => (node.props.fill as { payload?: number } | null)?.payload)
      .filter(value => value !== undefined)
    // Bubble and antenna white, then eyes in the accent.
    expect(fills).toEqual(expect.arrayContaining([processColor(accents.orange.onAccent), processColor(accents.orange.primary)]))
    expect(fills.indexOf(processColor(accents.orange.onAccent) as number)).toBeLessThan(fills.indexOf(processColor(accents.orange.primary) as number))
  })
})
