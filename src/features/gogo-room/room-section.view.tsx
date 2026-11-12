import type { ReactNode } from 'react'
import { View } from 'react-native'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { styles } from './room-section.style'

/** All lobby sections share the same heading geometry and 12pt description gap. */
export function RoomSectionHeading({ icon, title, action }: { icon: IconName; title: string; action?: ReactNode }) {
  return <View style={styles.heading}>
    <Icon name={icon} size={20} color="accent.primary" />
    <Text variant="discoveryHeading" accessibilityRole="header" style={styles.title}>{title}</Text>
    {action}
  </View>
}

export function RoomSectionDescription({ children }: { children: ReactNode }) {
  return <Text variant="bodySmall" color="text.secondary">{children}</Text>
}
