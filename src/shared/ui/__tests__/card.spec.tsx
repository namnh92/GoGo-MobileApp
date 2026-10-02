import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'

import * as primitives from '@/shared/ui/primitives'
import { Atmosphere, Card } from '@/shared/ui/primitives'
import { radius, shadows, spacing, surface } from '@/shared/ui/tokens'

/** #295 — `Card` per #293 §2. #298 removed the `GlassCard` alias; every call site is a `Card`. */
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)

describe('Card', () => {
  it('is a solid card surface with the card shadow, no border, padded by default', async () => {
    await render(<Card testID="c"><Text>x</Text></Card>)
    const style = flat('c')
    expect(style).toMatchObject({ backgroundColor: surface.card, borderRadius: radius.card, padding: spacing[4], ...shadows.card })
    expect(style.borderWidth).toBeUndefined()
    // Left to the caller, so the shadow is not clipped.
    expect(style.overflow).toBeUndefined()
  })

  it('unpadded when asked', async () => {
    await render(<Card testID="c" padded={false}><Text>x</Text></Card>)
    expect(flat('c').padding).toBeUndefined()
  })
})

describe('GlassCard', () => {
  it('is gone (#298) — a second card component would drift from Card', () => {
    expect(primitives).not.toHaveProperty('GlassCard')
  })
})

describe('Atmosphere', () => {
  it('is the flat canvas — no blobs, no blur', async () => {
    await render(<Atmosphere><Text testID="child">x</Text></Atmosphere>)
    const root = screen.getByTestId('child').parent!
    expect(StyleSheet.flatten(root.props.style)).toMatchObject({ flex: 1, backgroundColor: surface.canvas })
    expect(root.children).toHaveLength(1)
  })
})
