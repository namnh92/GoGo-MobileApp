import { Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { styles } from './count-badge.style'

const CAP = 9

/** What a count reads as: never past the cap, and `+` when more may exist. */
export function badgeLabel(count: number, more = false): string {
  return count > CAP ? `${CAP}+` : more ? `${count}+` : String(count)
}

/**
 * The small count on a control. `count` is the red unread number; `live` is the
 * green pill with a dot for something happening now, so the two read differently
 * without relying on colour alone. Nothing renders at zero. Decorative for screen
 * readers: the control it sits on says the number in its own label.
 */
export function CountBadge({
  count,
  more,
  tone = 'count',
  style,
}: {
  count: number
  more?: boolean
  tone?: 'count' | 'live'
  style?: StyleProp<ViewStyle>
}) {
  const { theme } = useUnistyles()
  if (count <= 0) return null
  return (
    <View
      testID={`count-badge-${tone}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, tone === 'live' ? styles.live : styles.count, style]}
    >
      {tone === 'live' ? <View style={styles.liveDot} /> : null}
      <RNText numberOfLines={1} style={[theme.type.caption, tone === 'live' ? styles.liveText : styles.countText]}>
        {badgeLabel(count, more)}
      </RNText>
    </View>
  )
}
