import { Image } from 'expo-image'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { IconMapPin } from '@/shared/ui/icons'

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
 *
 * The placeholder is one neutral tile with a pin (#293 §3). It used to pick a
 * pastel per place, which read as decoration — and as a category colour that
 * meant nothing.
 */
export function PlacePhoto({
  uri,
  name,
  icon,
  style,
  accessibilityLabel,
}: {
  /** Real place imagery once the contract provides it; undefined until then. */
  uri?: string | null
  /** Kept for callers; the placeholder no longer varies per place. */
  placeId: string
  name?: string
  /** Category emoji, when the caller knows it. */
  icon?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const { theme } = useUnistyles()
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
      style={[styles.placeholder, style]}
    >
      {icon ? (
        <Text style={styles.placeholderGlyph}>{icon}</Text>
      ) : (
        <IconMapPin size={28} color={theme.text.secondary} />
      )}
    </View>
  )
}
