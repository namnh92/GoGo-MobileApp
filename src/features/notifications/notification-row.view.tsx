import type { ReactNode } from 'react'
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { Card } from '@/shared/ui/primitives'
import { Text, type TextColor } from '@/shared/ui/text'
import { styles } from './notification-row.style'

/** Shared card geometry for personal notifications and public system broadcasts. */
export function NotificationRow({ id, testID, headingTestID, title, titleColor = 'text.primary', relativeTime,
  unread = false, icon, iconStyle, openTarget, actions, children }: {
  id?: string | null; testID?: string; headingTestID?: string
  title: string; titleColor?: TextColor; relativeTime: string | null
  unread?: boolean; icon: ReactNode; iconStyle?: StyleProp<ViewStyle>
  openTarget?: Pick<PressableProps, 'onPress' | 'disabled' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState'>
  actions?: ReactNode; children: ReactNode
}) {
  const content = <>
    <View testID={headingTestID ?? `notification-heading-${id}`} style={styles.cardHeading}>
      <Text variant="introLabel" color={titleColor} numberOfLines={2} ellipsizeMode="tail" style={styles.kind}>{title}</Text>
      <View style={styles.timeRow}>
        {relativeTime ? <Text variant="introCaption" color="text.secondary">{relativeTime}</Text> : null}
        {unread ? <View testID={`notification-unread-${id}`} style={styles.unreadDot} /> : null}
      </View>
    </View>
    {children}
  </>
  return <Card testID={testID} appearance="stitch" padded={false} style={[styles.row, unread && styles.rowUnread]}>
    <View testID={`notification-icon-${id}`} style={[styles.iconTile, iconStyle]}>{icon}</View>
    <View style={styles.content}>
      {openTarget ? <Pressable {...openTarget} accessibilityRole={openTarget.accessibilityRole ?? 'button'} style={styles.openTarget}>{content}</Pressable> : content}
      {actions}
    </View>
  </Card>
}
