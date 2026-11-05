import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Platform, Switch, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { acquisitionConfigured, setAcquisitionConsent } from '@/shared/acquisition/bootstrap'
import { consentStore } from '@/shared/consent/consent-store'
import { haptic } from '@/shared/ui/feedback'
import { Card, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { touchTarget } from '@/shared/ui/tokens'

import { styles } from './tracking-consent.style'

/**
 * GoGo-MobileApp#370 (shape D5) — where the sheet's "đổi lại được trong Cài
 * đặt" is true. Android: GoGo owns the answer, so a switch. iOS: the OS owns it,
 * so a way there. Either way this device's, not the account's. #404: the sheet is
 * short, so this row carries the two recipients and what goes either way.
 */
export function TrackingConsentSection() {
  if (Platform.OS === 'android') return <AndroidSwitch />
  if (Platform.OS === 'ios') return <IosSettingsLink />
  return null
}

function AndroidSwitch() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const consent = useSyncExternalStore(consentStore.subscribe, consentStore.snapshot)

  useEffect(() => {
    void consentStore.load()
  }, [])

  if (!acquisitionConfigured()) {
    return (
      <Card padded={false} style={styles.card}>
        <Text variant="bodySmall" color="text.secondary">{t('permissionsSettings.trackingUnavailable')}</Text>
      </Card>
    )
  }

  if (!consent.loaded) {
    return (
      <Card padded={false} style={styles.card}>
        <View accessible accessibilityLabel={t('common.loading')}>
          <Skeleton height={touchTarget.min} />
        </View>
      </Card>
    )
  }

  const on = consent.value === 'granted'

  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="bodySmall">{t('permissionsSettings.trackingSwitch')}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={next => {
            setAcquisitionConsent(next)
            haptic('select')
          }}
          trackColor={{ true: theme.accent.primary, false: theme.surface.subtle }}
          accessibilityLabel={t('permissionsSettings.trackingSwitch')}
        />
      </View>
      <Text variant="bodySmall" color="text.secondary">{t('permissionsSettings.trackingDetail')}</Text>
      {on ? null : <Text variant="bodySmall" color="text.secondary">{t('permissionsSettings.trackingOffHint')}</Text>}
      {consent.save === 'unsaved' ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="bodySmall" color="status.warningText">{t('permissionsSettings.trackingUnsaved')}</Text>
          <GhostBtn label={t('common.retry')} onPress={() => consentStore.retry()} />
        </View>
      ) : null}
    </Card>
  )
}

function IosSettingsLink() {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  async function open() {
    setFailed(false)
    try {
      await Linking.openSettings()
    } catch {
      setFailed(true)
    }
  }

  return (
    <Card padded={false} style={styles.card}>
      <Text variant="bodySmall">{t('permissionsSettings.trackingIos')}</Text>
      <SecondaryBtn label={t('permissionsSettings.openSettings')} onPress={() => void open()} icon="settings" />
      {failed ? (
        <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite">
          {t('notificationSettings.openSettingsFailed')}
        </Text>
      ) : null}
    </Card>
  )
}
