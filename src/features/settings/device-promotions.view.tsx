import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Linking, Switch, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { pushIdentity } from '@/shared/notifications/identity-bootstrap'
import { devicePromotionsStore } from '@/shared/notifications/device-promotions-store'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { haptic } from '@/shared/ui/feedback'
import { Card, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { touchTarget } from '@/shared/ui/tokens'

import { styles } from './device-promotions.style'

/**
 * GoGo-MobileApp#398 (shape D5) — the promotions switch of a device with no
 * account, and where "đổi lại được trong Cài đặt" on the sheet is true. Off is
 * not claimed until the provider showed it (R-16): "Đang tắt…" stays until then.
 * Signed in, the account switch decides everything and this is not rendered.
 */
export function DevicePromotionsSection() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const promotions = useSyncExternalStore(devicePromotionsStore.subscribe, devicePromotionsStore.snapshot)
  const [busy, setBusy] = useState(false)
  const [osOff, setOsOff] = useState(false)

  useEffect(() => {
    void devicePromotionsStore.load()
  }, [])

  const readPermission = useCallback(() => {
    void pushPermission.status().then(status => setOsOff(status === 'askable'))
  }, [])
  useFocusEffect(useCallback(() => {
    readPermission()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') readPermission()
    })
    return () => subscription.remove()
  }, [readPermission]))

  if (promotions.read === 'loading') {
    return (
      <Card padded={false} style={styles.card}>
        <View accessible accessibilityLabel={t('common.loading')}>
          <Skeleton height={touchTarget.min} />
        </View>
      </Card>
    )
  }

  const on = promotions.answer === 'accepted' && promotions.enabled
  const unavailable = promotions.serviceOff || promotions.read === 'unreadable'

  const onChange = (next: boolean) => {
    haptic('select')
    if (!next) {
      void pushIdentity.setPromotions(false)
      return
    }
    // The person asked for notifications: the moment the OS prompt is for.
    setBusy(true)
    void pushPermission
      .request()
      .catch(() => undefined)
      .then(() => pushIdentity.setPromotions(true))
      .finally(() => {
        setBusy(false)
        readPermission()
      })
  }

  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="label">{t('devicePromotions.switch')}</Text>
          <Text variant="bodySmall" color="text.secondary">{t('devicePromotions.hint')}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={onChange}
          disabled={busy || unavailable}
          trackColor={{ true: theme.accent.primary, false: theme.surface.subtle }}
          accessibilityLabel={t('devicePromotions.switch')}
          accessibilityHint={t('devicePromotions.hint')}
        />
      </View>
      <View accessibilityLiveRegion="polite">
        {promotions.serviceOff ? (
          <Text variant="bodySmall" color="text.secondary">{t('devicePromotions.serviceOff')}</Text>
        ) : promotions.read === 'unreadable' ? (
          <Text variant="bodySmall" color="status.warningText">{t('devicePromotions.unreadable')}</Text>
        ) : promotions.awaitingProviderOff ? (
          <Text variant="bodySmall" color="text.secondary">{t('devicePromotions.turningOff')}</Text>
        ) : null}
        {promotions.save === 'unsaved' ? (
          <>
            <Text variant="bodySmall" color="status.warningText">{t('devicePromotions.unsaved')}</Text>
            <GhostBtn label={t('common.retry')} onPress={() => devicePromotionsStore.retrySave()} />
          </>
        ) : null}
      </View>
      {on && osOff ? (
        <>
          <Text variant="bodySmall" color="status.warningText">{t('devicePromotions.osOff')}</Text>
          <SecondaryBtn label={t('notificationSettings.openSettings')} onPress={() => void Linking.openSettings().catch(() => undefined)} icon="settings" />
        </>
      ) : null}
    </Card>
  )
}
