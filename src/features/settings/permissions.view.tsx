import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NotificationSwitchSection } from '@/features/notifications/notification-switch.view'
import { useSession } from '@/shared/providers/session-provider'
import { Atmosphere, BackHeader, Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { DevicePromotionsSection } from './device-promotions.view'
import { LocationPermissionSection } from './location-permission.view'
import { styles } from './permissions.style'
import { TrackingConsentSection } from './tracking-consent.view'

/**
 * APP-058 (#216) — notifications, location and (#370) install measurement in one settings screen, reached
 * from one Profile row. Both earlier routes (`/settings/notifications`,
 * `/settings/location`) render this screen, so any link or navigation into
 * either still lands here.
 *
 * The location half needs no account: it is this device's permission. The
 * notification switch belongs to an account, so a signed-out person is offered
 * sign-in for that half only, next to this device's promotions switch (#398).
 * Install measurement is this device's too.
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
        <Text variant="label" color="text.secondary" accessibilityRole="header" style={styles.sectionTitle}>
          {t('permissionsSettings.notifications')}
        </Text>
        {status === 'user' ? (
          <NotificationSwitchSection />
        ) : (
          <>
            <DevicePromotionsSection />
            <Card padded={false} style={styles.signInCard}>
              <Text>{t('notifications.signInBody')}</Text>
              <GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />
            </Card>
          </>
        )}

        <Text variant="label" color="text.secondary" accessibilityRole="header" style={styles.sectionTitle}>
          {t('permissionsSettings.location')}
        </Text>
        <LocationPermissionSection />

        <Text variant="label" color="text.secondary" accessibilityRole="header" style={styles.sectionTitle}>
          {t('permissionsSettings.tracking')}
        </Text>
        <TrackingConsentSection />
      </ScrollView>
    </Atmosphere>
  )
}
