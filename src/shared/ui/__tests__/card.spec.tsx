import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'

import { Atmosphere, Card, GlassCard } from '@/shared/ui/primitives'
import { radius, shadows, spacing, surface } from '@/shared/ui/tokens'

/** #295 — `Card` per #293 §2, and the `GlassCard` alias that keeps 55 call sites unchanged. */
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

describe('GlassCard (deprecated alias)', () => {
  it('renders an unpadded Card and ignores strong — call sites keep their own padding', async () => {
    await render(
      <GlassCard strong interactive style={{ padding: 12 }}>
        <Text testID="child">x</Text>
      </GlassCard>,
    )
    const card = screen.getByTestId('child').parent!
    const style = StyleSheet.flatten(card.props.style)
    expect(style).toMatchObject({ backgroundColor: surface.card, padding: 12 })
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
