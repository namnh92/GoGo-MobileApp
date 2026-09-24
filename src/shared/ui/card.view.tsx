import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import { styles } from './card.style'

/**
 * The one card surface (#293 §2): solid `surface.card`, `radius.card`, the
 * Figma card shadow, no border. Solid on purpose — a card's contrast is the
 * card's, never whatever sits behind it.
 *
 * `overflow` is left alone so the shadow shows; a caller that clips an image to
 * the corners sets `overflow: 'hidden'` itself. Not pressable: wrap it in a
 * `Pressable` where the whole card is a target.
 */
export function Card({ children, style, padded = true, testID }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** 16pt inside. Off for a card whose content runs to the edge (a photo). */
  padded?: boolean
  testID?: string
}) {
  return (
    <View testID={testID} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  )
}
