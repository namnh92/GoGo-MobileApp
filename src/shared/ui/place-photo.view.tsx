import { Image } from 'expo-image'
import { useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { motionDuration, useReducedMotion } from '@/shared/ui/feedback'
import { IconMapPin } from '@/shared/ui/icons'
import { Glyph } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { styles } from './place-photo.style'

/**
 * A place image, or an honest stand-in.
 *
 * The real `uri` comes from the place's approved `photos[]`. A place without
 * one renders a neutral placeholder rather than a stock photo: a borrowed
 * image reads as a picture of the venue, and people choose where to go based
 * on it.
 *
 * The placeholder is one neutral tile with a pin (#293 §3). It used to pick a
 * pastel per place, which read as decoration — and as a category colour that
 * meant nothing.
 *
 * #338: the same tile stands in while the image loads (the image fades in
 * over it, an instant cut under reduced motion), and replaces it for good when
 * the bytes never arrive — HTTP error, not an image, offline. A failed photo
 * is never an empty frame, and never announced as a photo.
 */
const FILL = { width: '100%', height: '100%' } as const

export function PlacePhoto({
  uri,
  name,
  icon,
  style,
  accessibilityLabel,
}: {
  /** The place's approved photo, when it has one. */
  uri?: string | null
  /** Kept for callers; the placeholder no longer varies per place. */
  placeId: string
  name?: string
  /** Category emoji, when the caller knows it. */
  icon?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const reducedMotion = useReducedMotion()
  // Keyed by URL, so a new photo for the same place gets its own attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const [loadedUri, setLoadedUri] = useState<string | null>(null)
  const photo = uri && uri !== failedUri ? uri : null

  if (photo) {
    // `expo-image` is not a React Native view, so Unistyles cannot bind a
    // style to it. The caller's size, radius and clip go on a plain `View`;
    // the image only fills it, with a static style.
    return (
      <View style={[styles.image, style]}>
        {photo !== loadedUri ? <Pin icon={icon} testID="place-photo-loading" style={styles.underlay} /> : null}
        <Image
          testID="place-photo-image"
          source={{ uri: photo }}
          style={FILL}
          contentFit="cover"
          transition={motionDuration(motion.fast, reducedMotion)}
          onLoad={() => setLoadedUri(photo)}
          onError={() => setFailedUri(photo)}
          accessibilityLabel={accessibilityLabel ?? name}
        />
      </View>
    )
  }

  return <Pin icon={icon} testID="place-photo-placeholder" style={[styles.placeholder, style]} />
}

/**
 * Decorative: the place name is already rendered next to this, so a screen
 * reader announcing the tile again would just be noise.
 */
function Pin({ icon, testID, style }: { icon?: string; testID: string; style: StyleProp<ViewStyle> }) {
  const { theme } = useUnistyles()
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {icon ? <Glyph size="md">{icon}</Glyph> : <IconMapPin size={28} color={theme.text.secondary} />}
    </View>
  )
}
