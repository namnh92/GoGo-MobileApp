import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { useUnreadInbox } from '@/features/notifications/unread-count'
import { badgeLabel } from './count-badge.view'
import { Icon } from './icons'
import { styles } from './header-notification-button.style'

export function HeaderNotificationButton({ testID, unreadDotTestID, showUnread = true }: { testID: string; unreadDotTestID: string; showUnread?: boolean }) {
  const router = useRouter()
  const { t } = useTranslation()
  const unread = useUnreadInbox()

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={
        showUnread && unread.count > 0
          ? t('home.bellUnread', { count: badgeLabel(unread.count, unread.more) })
          : t('notifications.title')
      }
      style={styles.button}
    >
      <Icon name="bell" size={22} color="redesign.primaryText" />
      {showUnread && unread.count > 0 ? <View testID={unreadDotTestID} style={styles.unreadDot} /> : null}
    </Pressable>
  )
}
