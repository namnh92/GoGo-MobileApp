import { View, type StyleProp, type ViewStyle } from 'react-native'

import { styles } from './count-badge.style'
import { Text } from './text'

const CAP = 9

/** What a count reads as: never past the cap, and `+` when more may exist. */
export function badgeLabel(count: number, more = false): string {
  return count > CAP ? `${CAP}+` : more ? `${count}+` : String(count)
}

/**
 * The small count on a control. `count` is the red unread number; `upcoming` is
 * the green pill, and `live` adds a dot when something is happening now, so a
 * live date reads differently without relying on colour alone. Nothing renders at zero. Decorative for screen
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
  tone?: 'count' | 'upcoming' | 'live'
  style?: StyleProp<ViewStyle>
}) {
  if (count <= 0) return null
  return (
    <View
      testID={`count-badge-${tone}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, tone === 'count' ? styles.count : styles.live, style]}
    >
      {tone === 'live' ? <View style={styles.liveDot} /> : null}
      <Text variant="caption" color={tone === 'count' ? 'accent.onAccent' : 'status.successText'} numberOfLines={1}>
        {badgeLabel(count, more)}
      </Text>
    </View>
  )
}
