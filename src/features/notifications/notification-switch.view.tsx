import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, AppState, Linking, Switch, Text, View } from 'react-native'

import { useNotificationSettings, useSetNotificationSettings } from '@/shared/api'
import type { MessageKey } from '@/shared/i18n/types'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { colors } from '@/shared/ui/tokens'

import { styles } from './notification-switch.style'

/**
 * `checking` is the first read still in flight; `unknown` is a read that came
 * back unusable. Collapsing them made a normal screen open flash "could not be
 * checked" and a Retry button before the SDK had answered at all.
 */
type PushState = 'checking' | 'granted' | 'askable' | 'unknown'

const DEVICE_NOTE: Record<PushState, MessageKey> = {
  checking: 'notificationSettings.pushChecking',
  granted: 'notificationSettings.pushReady',
  askable: 'notificationSettings.pushNote',
  unknown: 'notificationSettings.pushUnknown',
}

/**
 * NTF-APP-010 (#215) — one switch for every push kind (GoGo-BE#572, ADR-0025),
 * as a section of the combined settings screen (APP-058, #216).
 *
 * Two facts, never merged: the switch is what this *account* asked GoGo to do,
 * on every device; the device card is whether *this phone* lets GoGo show a
 * notification. Neither says anything was delivered. Signed-in accounts only —
 * the screen decides who sees this.
 */
export function NotificationSwitchSection() {
  const { t } = useTranslation()
  const settings = useNotificationSettings()
  const save = useSetNotificationSettings()

  const [pushState, setPushState] = useState<PushState>('checking')
  const [settingsError, setSettingsError] = useState(false)
  const permissionRevision = useRef(0)
  const refreshPushState = useCallback(() => {
    const currentRevision = ++permissionRevision.current
    void pushPermission.status().then(next => {
      if (currentRevision !== permissionRevision.current) return
      if (next !== 'askable') setSettingsError(false)
      setPushState(next)
    })
  }, [])
  useFocusEffect(useCallback(() => {
    refreshPushState()
    // Coming back from OS Settings is the common path; the card must read true.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPushState()
    })
    return () => {
      permissionRevision.current += 1
      subscription.remove()
    }
  }, [refreshPushState]))

  async function openNotificationSettings() {
    setSettingsError(false)
    try {
      await Linking.openSettings()
    } catch {
      setSettingsError(true)
    }
  }

  const current = settings.data
  // Off because an older choice was carried over conservatively — say why.
  const carriedOver = current && !current.pushEnabled && (current.source === 'migrated' || current.source === 'legacy')

  return (
    <View>
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('notificationSettings.switchLabel')}</Text>
            <Text style={styles.rowHint}>{t('notificationSettings.switchHint')}</Text>
          </View>
          <Switch
            // Until the first answer there is no truthful value: off and locked.
            value={current?.pushEnabled ?? false}
            onValueChange={next => save.mutate({ pushEnabled: next })}
            disabled={!current || save.isPending}
            trackColor={{ true: colors.brand.coral, false: colors.neutral[100] }}
            accessibilityLabel={t('notificationSettings.switchLabel')}
            accessibilityHint={t('notificationSettings.switchHint')}
          />
        </View>

        {!current ? (
          <View accessibilityLiveRegion="polite" style={styles.syncState}>
            {settings.isPending ? (
              <>
                <ActivityIndicator color={colors.brand.coral} size="small" />
                <Text style={styles.syncText}>{t('common.loading')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.error}>{t('notificationSettings.loadFailed')}</Text>
                <GhostBtn label={t('common.retry')} onPress={() => void settings.refetch()} />
              </>
            )}
          </View>
        ) : null}

        {carriedOver ? <Text style={styles.hint}>{t('notificationSettings.migratedOff')}</Text> : null}
      </GlassCard>

      {save.isError ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{t('notificationSettings.saveFailed')}</Text>
          {save.variables ? (
            <GhostBtn
              label={t('notificationSettings.retrySave')}
              onPress={() => save.variables && save.mutate(save.variables)}
            />
          ) : null}
        </View>
      ) : null}

      <Text style={styles.subTitle}>{t('notificationSettings.deviceTitle')}</Text>
      <GlassCard style={styles.deviceCard}>
        <Text
          accessibilityLiveRegion="polite"
          style={pushState === 'granted' || pushState === 'checking' ? styles.note : styles.warning}
        >
          {t(DEVICE_NOTE[pushState])}
        </Text>
        {pushState === 'askable' ? (
          <SecondaryBtn
            label={t('notificationSettings.openSettings')}
            onPress={() => void openNotificationSettings()}
          />
        ) : pushState === 'unknown' ? (
          <GhostBtn label={t('common.retry')} onPress={refreshPushState} />
        ) : null}
        {settingsError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('notificationSettings.openSettingsFailed')}
          </Text>
        ) : null}
      </GlassCard>

      <Text style={styles.caption}>{t('notificationSettings.inboxNote')}</Text>
    </View>
  )
}
