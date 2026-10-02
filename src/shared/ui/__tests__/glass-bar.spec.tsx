import { act, render, renderHook, screen } from '@testing-library/react-native'
import { Platform, StyleSheet, Text } from 'react-native'

import { GlassBar, selectGlassMaterial, TAB_BAR_HEIGHT, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { IconBookmark, IconCalendar, IconHome, IconUser } from '@/shared/ui/icons'
import { accents, border, glass, spacing, text } from '@/shared/ui/tokens'

/**
 * #296. jest.setup mocks the safe area at bottom 34 (an iPhone with a home
 * indicator) and `@callstack/liquid-glass` as unsupported — the fallback path.
 */
const SAFE_BOTTOM = 34
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

describe('selectGlassMaterial', () => {
  it.each([
    ['ios', true, 'native'],
    ['ios', false, 'blur'],
    ['android', true, 'wash'],
    ['android', false, 'wash'],
    ['web', false, 'wash'],
  ] as const)('%s, liquid glass %s → %s', (os, supported, material) => {
    expect(selectGlassMaterial(os, supported)).toBe(material)
  })
})

describe('GlassBar', () => {
  const realOS = Platform.OS
  afterEach(() => {
    Platform.OS = realOS
  })

  it('iOS without system glass: blur under the 78 % wash, hairline on top', async () => {
    Platform.OS = 'ios'
    await render(<GlassBar testID="bar" />)
    expect(screen.getByTestId('glass-bar-blur')).toBeTruthy()
    expect(screen.queryByTestId('glass-bar-native')).toBeNull()
    expect(flat('glass-bar-wash')).toMatchObject({ backgroundColor: glass.bar.wash })
    expect(flat('bar')).toMatchObject({ borderTopWidth: 1, borderTopColor: border.hairline })
  })

  it('Android: the wash alone — contrast never depends on a blur', async () => {
    Platform.OS = 'android'
    await render(<GlassBar testID="bar" />)
    expect(screen.queryByTestId('glass-bar-blur')).toBeNull()
    expect(screen.queryByTestId('glass-bar-native')).toBeNull()
    expect(flat('glass-bar-wash')).toMatchObject({ backgroundColor: glass.bar.wash })
  })

  it('fill: no padding or position of its own — the caller places it', async () => {
    await render(<GlassBar testID="bar" />)
    const style = flat('bar')
    expect(style.position).toBeUndefined()
    expect(style.paddingBottom).toBeUndefined()
  })

  it('floating: pinned to the bottom edge, gutter, padded over the safe area, children on top', async () => {
    await render(
      <GlassBar testID="bar" placement="floating">
        <Text testID="cta">Tiếp tục</Text>
      </GlassBar>,
    )
    expect(flat('bar')).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: SAFE_BOTTOM + spacing[4],
    })
    expect(screen.getByTestId('cta')).toBeTruthy()
  })

  it('docked: the same padding, in the layout flow', async () => {
    await render(<GlassBar testID="bar" placement="docked" />)
    const style = flat('bar')
    expect(style.position).toBeUndefined()
    expect(style).toMatchObject({ paddingTop: spacing[4], paddingBottom: SAFE_BOTTOM + spacing[4] })
  })

  it('reports its height without the safe area — what useBottomBarInset takes', async () => {
    const onHeightChange = jest.fn()
    await render(<GlassBar testID="bar" placement="floating" onHeightChange={onHeightChange} />)
    await act(async () => {
      screen.getByTestId('bar').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 122 } } })
    })
    expect(onHeightChange).toHaveBeenCalledWith(122 - SAFE_BOTTOM)
  })
})

describe('useBottomBarInset', () => {
  it('defaults to the tab bar: 50 + safe area (84 on the Figma frame)', async () => {
    const { result } = await renderHook(() => useBottomBarInset())
    expect(TAB_BAR_HEIGHT).toBe(50)
    expect(result.current).toBe(TAB_BAR_HEIGHT + SAFE_BOTTOM)
  })

  it('an action bar passes its measured height', async () => {
    const { result } = await renderHook(() => useBottomBarInset(88))
    expect(result.current).toBe(88 + SAFE_BOTTOM)
  })
})

describe('tab icons (#296)', () => {
  const svgProps = (testID: string) => screen.getByTestId(testID).props as { fill?: string; stroke?: string }

  it.each([
    ['home', IconHome],
    ['calendar', IconCalendar],
    ['bookmark', IconBookmark],
    ['user', IconUser],
  ] as const)('%s: active is a filled glyph, inactive an outline in text.secondary', async (name, Icon) => {
    await render(<Icon active />)
    expect(screen.getByTestId(`icon-${name}-filled`)).toBeTruthy()
    await render(<Icon />)
    expect(screen.queryByTestId(`icon-${name}-filled`)).toBeNull()
    expect(svgProps(`icon-${name}`).stroke).toBe(text.secondary)
  })

  it('the active tint is the theme accent', async () => {
    await render(<IconUser active />)
    expect(svgProps('icon-user-filled')).toMatchObject({ fill: accents.orange.primary, stroke: accents.orange.primary })
  })
})
