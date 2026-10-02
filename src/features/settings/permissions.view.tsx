import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NotificationSwitchSection } from '@/features/notifications/notification-switch.view'
import { useSession } from '@/shared/providers/session-provider'
import { Atmosphere, BackHeader, Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { LocationPermissionSection } from './location-permission.view'
import { styles } from './permissions.style'

/**
 * APP-058 (#216) — notifications and location in one settings screen, reached
 * from one Profile row. Both earlier routes (`/settings/notifications`,
 * `/settings/location`) render this screen, so any link or navigation into
 * either still lands here.
 *
 * The location half needs no account: it is this device's permission. The
 * notification switch belongs to an account, so a signed-out person is offered
 * sign-in for that half only.
 */
export default function PermissionsSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} title={t('permissionsSettings.title')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}>
        <Text variant="title2" accessibilityRole="header" style={styles.sectionTitle}>
          {t('permissionsSettings.notifications')}
        </Text>
        {status === 'user' ? (
          <NotificationSwitchSection />
        ) : (
          <Card padded={false} style={styles.signInCard}>
            <Text>{t('notifications.signInBody')}</Text>
            <GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />
          </Card>
        )}

        <Text variant="title2" accessibilityRole="header" style={styles.sectionTitle}>
          {t('permissionsSettings.location')}
        </Text>
        <LocationPermissionSection />
      </ScrollView>
    </Atmosphere>
  )
}
