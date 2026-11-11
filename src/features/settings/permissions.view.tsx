import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, View } from 'react-native'

import { NotificationSettingsRow } from '@/features/notifications/notification-settings-row.view'
import { useSession } from '@/shared/providers/session-provider'
import { Card, PrimaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { SettingsPage, BuildVersion } from './settings-page.view'

import { DevicePromotionsSection } from './device-promotions.view'
import { LocationPermissionSection } from './location-permission.view'
import { styles } from './permissions.style'
import { TrackingConsentSection } from './tracking-consent.view'

/** Permissions stay device-scoped; account notification controls live at
 * /settings/notifications (#539). Keep this row independent of the system
 * settings section shared with #567. */
export default function PermissionsSettingsScreen() {
  const { t } = useTranslation()
  const [settingsFailed, setSettingsFailed] = useState(false)
  async function openSystemSettings() {
    setSettingsFailed(false)
    try { await Linking.openSettings() } catch { setSettingsFailed(true) }
  }
  const { status } = useSession()

  return (
    <SettingsPage title={t('permissionsSettings.title')}>
        <Card appearance="stitch" padded={false} style={styles.intro}>
          <View style={styles.introRow}><View style={styles.icon}><MaterialIcon name="shield" size={24} color="status.infoText" /></View><View style={styles.introText}>
            <Text variant="introHeading">{t('g11.permissionsHeading')}</Text>
            <Text variant="introRelaxed" color="text.secondary">{t('g11.permissionsIntro')}</Text>
          </View></View>
        </Card>
        <View style={styles.section}>
        <Text variant="introSmall" color="text.secondary" accessibilityRole="header" style={styles.sectionTitle}>{t('g11.devicePermissions')}</Text>
        <Card appearance="stitch" padded={false} style={styles.deviceCard}>
        <NotificationSettingsRow />
        {status !== 'user' ? <DevicePromotionsSection showSettingsButton={false} /> : null}

        <LocationPermissionSection showSettingsButton={false} />
        </Card>
        </View>

        <View testID="permissions-system-section" style={styles.section}>
          <Text variant="introSmall" color="text.secondary" accessibilityRole="header" style={styles.systemSectionTitle}>{t('g11.system')}</Text>
          <TrackingConsentSection showSettingsButton={false} testID="permissions-system-card" footer={
            <>
              <PrimaryBtn variant="pill" label={t('g11.openSystem')} leadingIcon="external" onPress={() => void openSystemSettings()} />
              {settingsFailed ? <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite">{t('notificationSettings.openSettingsFailed')}</Text> : null}
            </>
          } />
        </View>
        <BuildVersion />
    </SettingsPage>
  )
}
