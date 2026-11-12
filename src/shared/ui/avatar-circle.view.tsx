import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { ScaledText } from './text'
import { MaterialIcon } from './material-icon'
import { Icon } from './icons'
import { styles } from './avatar-circle.style'

/**
 * One avatar for every surface (RULE-CORE-015). `imageUri` is the profile
 * picture the API composed (ADR-0022); when it is absent, or the bytes fail to
 * load — a purged object, a dead edge cache, no network — the initials are
 * drawn instead, so a broken image never ships. The failed URI is remembered
 * rather than a boolean, so a fresh picture after a failure is tried again.
 */
export function AvatarCircle({ label, size = 40, background, emoji, imageUri, icon, host = false }: {
  /** Mark the room host; the containing row supplies the accessible role. */
  host?: boolean
  icon?: 'user'
  label?: string
  size?: number
  /** Defaults to the theme accent. */
  background?: string
  emoji?: string
  /** Absolute URL from `GET /me` or `RoomMember.avatarUrl`; null or undefined = initials. */
  imageUri?: string | null
}) {
  const { theme } = useUnistyles()
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const [loadedUri, setLoadedUri] = useState<string | null>(null)
  const uri = imageUri && imageUri !== failedUri ? imageUri : null
  const circle = { width: size, height: size, borderRadius: size / 2 }
  const avatar = (
    <View
      style={[
        styles.avatar,
        circle,
        { backgroundColor: icon ? theme.accent.primaryDeep : emoji ? theme.surface.subtle : background ?? theme.accent.primary },
      ]}
    >
      {icon ? <MaterialIcon name={icon} size={18} color="accent.onAccent" /> : <>
        {!uri || loadedUri !== uri ? (emoji ? <ScaledText box={size} kind="emoji">{emoji}</ScaledText> : <ScaledText box={size} kind="initials">{label}</ScaledText>) : null}
        {uri ? <Image
          testID="avatar-image"
          source={{ uri, cacheKey: uri }}
          style={[circle, styles.avatarImage]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onLoad={() => setLoadedUri(uri)}
          onError={() => setFailedUri(uri)}
        /> : null}
      </>}
    </View>
  )
  if (!host) return avatar
  return (
    <View style={circle}>
      {avatar}
      <View pointerEvents="none" style={[styles.hostRing, circle]} />
      <View testID="avatar-host-badge" pointerEvents="none" accessible={false} style={styles.hostBadge}>
        <Icon name="star" size={12} color="accent.primary" filled />
      </View>
    </View>
  )
}

