import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { useNotificationSettings } from '@/shared/api'
import type { MessageKey } from '@/shared/i18n/types'
import { useSession } from '@/shared/providers/session-provider'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { useNotificationDevice } from './use-notification-device'
import { styles } from './notification-settings-row.style'

/** Read-only summary; the account preference and device permission stay separate. */
export function NotificationSettingsRow() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const settings = useNotificationSettings({ enabled: status === 'user' })
  const { pushState } = useNotificationDevice()
  const statusKey: MessageKey = pushState === 'askable' ? 'notificationSettings.statusBlocked'
    : pushState === 'checking' ? 'notificationSettings.pushChecking'
      : pushState === 'unknown' ? 'notificationSettings.pushUnknown'
        : status !== 'user' ? 'auth.signInCta'
          : typeof settings.data?.pushEnabled === 'boolean' ? settings.data.pushEnabled ? 'notificationSettings.statusOn' : 'notificationSettings.statusOff'
            : settings.isPending && !settings.isPaused ? 'common.loading' : 'notificationSettings.loadFailed'

  return <Pressable accessibilityRole="button" accessibilityLabel={t('notificationSettings.switchLabel')}
    accessibilityValue={{ text: t(statusKey) }} accessibilityHint={t('g10.settingsTitle')} onPress={() => router.push('/settings/notifications')} style={styles.row}>
    <View style={styles.icon}><Icon name="bell" size={20} color="accent.onSoft" /></View>
    <View style={styles.text}>
      <Text variant="introHeading">{t('notificationSettings.switchLabel')}</Text>
      <Text variant="introCaption" color="text.secondary" accessibilityLiveRegion="polite">{t(statusKey)}</Text>
    </View>
    <Icon name="chevronRight" size={20} color="text.secondary" />
  </Pressable>
}
