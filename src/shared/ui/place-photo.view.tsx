import { Image } from 'expo-image'
import { useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { motionDuration, useReducedMotionPreference } from '@/shared/ui/feedback'
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
 * over it, an instant cut under reduced motion), and replaces it when the
 * bytes never arrive — HTTP error, not an image, offline. A failed photo is
 * never an empty frame, and never announced as a photo.
 */
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const

type Props = {
  /** The place's approved photo, when it has one. */
  cachePolicy?: 'none'
  imageTestID?: string
  onPhotoError?: () => void
  uri?: string | null
  /** Kept for callers; the placeholder no longer varies per place. */
  placeId: string
  name?: string
  /** Category emoji, when the caller knows it. */
  icon?: string
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

export function PlacePhoto({ uri, style, icon, ...rest }: Props) {
  if (!uri) return <View testID="place-photo-frame" style={[styles.image, style]}><Pin icon={icon} testID="place-photo-placeholder" style={styles.underlay} /></View>
  // One attempt per URL: a new URL — or the same one again later — starts
  // from "loading", never from what an earlier URL ended in (Sol #348 F-02).
  return <PhotoAttempt key={uri} uri={uri} style={style} icon={icon} {...rest} />
}

function PhotoAttempt({ uri, name, icon, style, accessibilityLabel, cachePolicy, imageTestID, onPhotoError }: Props & { uri: string }) {
  const reduced = useReducedMotionPreference()
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const label = accessibilityLabel ?? name

  // `expo-image` is not a React Native view, so Unistyles cannot bind a
  // style to it. The caller's size, radius and clip go on a plain `View`;
  // the image only fills it, with a static style. Keep the neutral tile under
  // the full native fade; neither layer contributes to the frame's geometry.
  return (
    <View testID="place-photo-frame" style={[styles.image, style]}>
      <Pin icon={icon} testID={status === 'loaded' ? 'place-photo-underlay' : status === 'failed' ? 'place-photo-placeholder' : 'place-photo-loading'} style={styles.underlay} />
      {status !== 'failed' ? <Image
        testID={imageTestID ?? 'place-photo-image'}
        source={{ uri }}
        cachePolicy={cachePolicy}
        // The view is not reused for another place's picture (Sol #348 F-01).
        recyclingKey={uri}
        style={FILL}
        contentFit="cover"
        // Not yet known counts as reduced: a cached image can land on the
        // first frame, before the OS answers (Sol #348 F-03).
        transition={motionDuration(motion.standard, reduced !== false)}
        onLoad={() => setStatus('loaded')}
        onError={() => { setStatus('failed'); onPhotoError?.() }}
        // expo-image is not an accessibility element by default, so a label on
        // its own is never read. Opt in only when there is one (Sol #348 F-06).
        accessible={label !== undefined}
        accessibilityLabel={label}
      /> : null}
    </View>
  )
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
