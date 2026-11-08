import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Linking, View } from 'react-native'

import { NotificationSwitchSection } from '@/features/notifications/notification-switch.view'
import { useSession } from '@/shared/providers/session-provider'
import { Card, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { SettingsPage, BuildVersion } from './settings-page.view'

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
  const [settingsFailed, setSettingsFailed] = useState(false)
  async function openSystemSettings() {
    setSettingsFailed(false)
    try { await Linking.openSettings() } catch { setSettingsFailed(true) }
  }
  const { status } = useSession()

  return (
    <SettingsPage title={t('permissionsSettings.title')}>
        <Card appearance="stitch" padded={false} style={styles.intro}>
          <View style={styles.introRow}><View style={styles.icon}><MaterialIcon name="shield" size={24} color="redesign.violetText" /></View><View style={styles.introText}>
            <Text variant="introHeading">{t('g11.permissionsHeading')}</Text>
            <Text variant="introRelaxed" color="redesign.secondary">{t('g11.permissionsIntro')}</Text>
          </View></View>
        </Card>
        <View style={styles.section}>
        <Text variant="introSmall" color="redesign.secondary" accessibilityRole="header" style={styles.sectionTitle}>{t('g11.devicePermissions')}</Text>
        <Card appearance="stitch" padded={false} style={styles.deviceCard}>
        {status === 'user' ? (
          <NotificationSwitchSection showSettingsButton={false} />
        ) : (
          <>
            <DevicePromotionsSection showSettingsButton={false} />
            <Card appearance="stitch" padded={false} style={styles.signInCard}>
              <Text>{t('notifications.signInBody')}</Text>
              <GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />
            </Card>
          </>
        )}

        <LocationPermissionSection showSettingsButton={false} />
        </Card>
        </View>

        <View style={styles.section}>
        <Text variant="introSmall" color="redesign.secondary" accessibilityRole="header" style={styles.sectionTitle}>{t('g11.analytics')}</Text>
        <TrackingConsentSection showSettingsButton={false} />
        </View>
        <View style={styles.section}>
        <Text variant="introSmall" color="redesign.secondary" accessibilityRole="header" style={styles.sectionTitle}>{t('g11.system')}</Text>
        <Card appearance="stitch" padded={false} style={styles.intro}>
          <View testID="permissions-system-row" style={styles.systemRow}><View style={styles.systemIcon}><Icon name="settings" size={24} /></View><Text variant="introHeading" style={styles.introText}>{t('g11.systemHeading')}</Text></View>
          <PrimaryBtn variant="pill" label={t('g11.openSystem')} leadingIcon="external" onPress={() => void openSystemSettings()} />
          {settingsFailed ? <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite">{t('notificationSettings.openSettingsFailed')}</Text> : null}
        </Card>
        </View>
        <BuildVersion />
    </SettingsPage>
  )
}
