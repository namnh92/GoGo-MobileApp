import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { styles } from './room-section.style'

/** All lobby sections share the same heading geometry and 12pt description gap. */
export function RoomSectionHeading({ icon, title, action, compactAction }: {
  icon: IconName; title: string; action?: ReactNode
  /** Anchor compact controls to the card so heading bounds cannot clip hitSlop. */
  compactAction?: (style: StyleProp<ViewStyle>) => ReactNode
}) {
  return <>
  <View style={[styles.heading, compactAction && styles.headingWithAction]}>
    <Icon name={icon} size={20} color="accent.primary" />
    <Text variant="discoveryHeading" accessibilityRole="header" style={styles.title}>{title}</Text>
    {action}
  </View>
  {compactAction?.(styles.compactAction)}
  </>
}

export function RoomSectionDescription({ children }: { children: ReactNode }) {
  return <Text variant="bodySmall" color="text.secondary">{children}</Text>
}
