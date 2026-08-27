import { Image } from 'expo-image'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors } from '@/shared/ui/tokens'

import { styles } from './place-photo.style'

/**
 * A place image, or an honest stand-in.
 *
 * The `/v1` contract carries no place photo yet (GoGo-BE#151). Until it does,
 * an API-backed place renders a neutral placeholder rather than a stock photo:
 * a borrowed image reads as a picture of the venue, and people choose where to
 * go based on it.
 *
 * When `primaryPhoto` / `photos[]` land, pass the real `uri` and the fallback
 * simply stops being used.
 */
const PLACEHOLDER_TINTS = [
  colors.brand.coralGhost,
  colors.brand.lavenderSoft,
  colors.brand.mintSoft,
  colors.brand.amberSoft,
  colors.neutral[100],
] as const

/** Same place, same tint, every render — a stable identity, not decoration. */
function tintFor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000
  }
  return PLACEHOLDER_TINTS[hash % PLACEHOLDER_TINTS.length]
}

export function PlacePhoto({
  uri,
  placeId,
  name,
  icon,
  style,
  accessibilityLabel,
}: {
  /** Real place imagery once the contract provides it; undefined until then. */
  uri?: string | null
  /** Seeds the placeholder tint so a place keeps the same colour. */
  placeId: string
  name?: string
  /** Category emoji, when the caller knows it. */
  icon?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, style as object]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={accessibilityLabel ?? name}
      />
    )
  }

  // Decorative: the place name is already rendered next to this, so a screen
  // reader announcing the tile again would just be noise.
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.placeholder, { backgroundColor: tintFor(placeId) }, style]}
    >
      <Text style={styles.placeholderGlyph}>{icon ?? '📍'}</Text>
    </View>
  )
}
