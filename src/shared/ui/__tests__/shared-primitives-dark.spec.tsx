import { render, screen } from '@testing-library/react-native'
import { Text as RNText, StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'

import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import { darkBorder, darkStatus, darkSurface, mapColors } from '@/shared/ui/tokens'

/**
 * Group 01 (shared primitives) on a dark device. The unistyles mock resolves
 * every theme-function stylesheet against the first registered theme, so
 * registering only the dark one before the modules load is a dark device. A
 * static stylesheet cannot follow it: each assertion here failed while the
 * shared component still read a light token at import.
 */
UnistylesSheet.configure({ themes: { orangeDark: themes.orangeDark } as unknown as typeof themes })

const flat = (style: unknown): Record<string, unknown> => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>

describe('shared primitives on a dark device', () => {
  it('glassStyles card and strong are the dark card with the dark hairline', () => {
    const { glassStyles } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    for (const look of [glassStyles.card, glassStyles.strong]) {
      expect(flat(look).backgroundColor).toBe(darkSurface.card)
      expect(flat(look).borderColor).toBe(darkBorder.hairline)
    }
  })

  it('the image placeholder behind a remote photo is the dark subtle surface', async () => {
    const { RemoteImage } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    await render(<RemoteImage uri="https://example.test/a.jpg" style={{ width: 4, height: 4 }} />)
    const image = screen.toJSON() as unknown as { props: { style?: unknown } }
    expect(flat(image.props.style).backgroundColor).toBe(darkSurface.subtle)
  })

  it('the BackHeader button is the dark card, not a light one under light text', async () => {
    const { BackHeader } = jest.requireActual<typeof import('@/shared/ui/primitives')>('@/shared/ui/primitives')
    await render(<BackHeader title="T" onBack={jest.fn()} />)
    const button = screen.getByRole('button', { name: /.+/ })
    const style = button.props.style
    const resolved = flat(typeof style === 'function' ? style({ pressed: false }) : style)
    expect(resolved.backgroundColor).toBe(darkSurface.card)
  })

  it('the map fallback surface is not the light map green', async () => {
    const { MapCanvas } = jest.requireActual<typeof import('@/shared/ui/map-canvas.view')>('@/shared/ui/map-canvas.view')
    await render(<MapCanvas pins={[]} fallback={<RNText testID="fb">x</RNText>} />)
    expect(flat(screen.getByTestId('fb').parent!.props.style).backgroundColor).not.toBe(mapColors.canvas)
  })

  it('the stale notice bar is the dark warning surface', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/async-state.style')>('@/shared/ui/async-state.style')
    expect(styles.staleBar.backgroundColor).toBe(darkStatus.warningSoft)
  })

  it('the skeleton block is the dark subtle surface', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/skeleton.style')>('@/shared/ui/skeleton.style')
    expect(styles.block.backgroundColor).toBe(darkSurface.subtle)
  })

  it('the place-card save toggle is the dark card', () => {
    const { styles } = jest.requireActual<typeof import('@/shared/ui/place-card.style')>('@/shared/ui/place-card.style')
    const toggle = Object.values(styles).find(s => (s as { borderRadius?: number }).borderRadius === 22 && (s as { width?: number }).width === 44)
    expect((toggle as { backgroundColor: string }).backgroundColor).toBe(darkSurface.card)
  })
})
