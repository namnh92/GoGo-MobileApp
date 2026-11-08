import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { useNotificationSettings, useSetNotificationSettings } from '@/shared/api'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { useSession } from '@/shared/providers/session-provider'
import { AppHeader } from '@/shared/ui/app-header.view'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, GhostBtn } from '@/shared/ui/primitives'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { notificationCapabilities, notificationCategories } from './notification-capabilities'
import { kindPresentation } from './notification-kind'
import { useNotificationDevice } from './use-notification-device'
import { styles } from './notification-settings.style'

export default function NotificationSettingsScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { status } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const settings = useNotificationSettings({ enabled: status === 'user' })
  const save = useSetNotificationSettings()
  const device = useNotificationDevice()
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const current = status === 'user' ? settings.data : undefined
  const capabilities = notificationCapabilities(current)
  const trackColor = { true: theme.accent.primary, false: theme.redesign.highest }

  function saveMaster(next: boolean) {
    if (!capabilities.master || save.isPending) return
    setResult(null)
    save.mutate({ pushEnabled: next }, {
      onSuccess: () => setResult('success'),
      onError: () => setResult('error'),
    })
  }

  return <Atmosphere redesign>
    <AppHeader showNotifications={false} title={t('g10.settingsTitle')} onBack={() => goBackOrHome(router)} />
    {status !== 'user' ? <EmptyState title={t('notifications.signInTitle')} body={t('notifications.signInBody')}
      action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> :
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Card appearance="stitchLow" padded={false} style={styles.device}>
          <View style={styles.deviceIcon}>
            <Icon name={device.pushState === 'granted' ? 'checkCircle' : 'info'} size={20}
              color={device.pushState === 'granted' ? 'redesign.greenText' : 'text.secondary'} />
          </View>
          <View style={styles.flex}>
            <Text variant="introSmall" color="redesign.ink">{t('notificationSettings.deviceTitle')}</Text>
            <Text variant="introCaption" color="redesign.secondary" accessibilityLiveRegion="polite">
              {t(device.pushState === 'granted' ? 'notificationSettings.pushReady' : device.pushState === 'checking'
                ? 'notificationSettings.pushChecking' : device.pushState === 'askable'
                  ? 'notificationSettings.pushNote' : 'notificationSettings.pushUnknown')}
            </Text>
            {device.pushState === 'unknown' ? <GhostBtn size="small" label={t('common.retry')} onPress={device.refreshPushState} /> : null}
          </View>
          <GhostBtn size="small" label={t('g10.deviceSettings')} onPress={() => void device.openNotificationSettings()} />
        </Card>
        {device.settingsError ? <Text color="status.dangerText" accessibilityLiveRegion="polite">{t('notificationSettings.openSettingsFailed')}</Text> : null}
        <StaleNotice hasData={!!current} error={settings.error} onRetry={() => void settings.refetch()} />
        <Card appearance="stitch" padded={false} style={styles.master}>
          <View style={styles.row}>
            <View style={styles.heroIcon}><Icon name="bell" size={26} color="accent.onSoft" /></View>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text variant="introHeading" color="redesign.ink">{t('g10.allNotifications')}</Text>
                <View style={styles.badge}><Text variant="introCaption" numberOfLines={1} color="accent.onSoft">{t('g10.masterBadge')}</Text></View>
              </View>
              <Text variant="introSmall" color="redesign.secondary">{t('g10.masterHint')}</Text>
            </View>
            <Switch testID="notification-master" value={current?.pushEnabled ?? false} disabled={!capabilities.master || save.isPending}
              onValueChange={saveMaster} accessibilityLabel={t('g10.allNotifications')} accessibilityHint={t('g10.masterHint')}
              accessibilityState={{ disabled: !capabilities.master || save.isPending, busy: save.isPending }} trackColor={trackColor} />
          </View>
          {!current && settings.isPaused ? <OfflineState /> : !current && settings.isPending ?
            <View testID="notification-settings-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={styles.loading}>
              <Skeleton width="80%" height={18} /><Skeleton width="65%" height={14} />
            </View> : !current && settings.isError ? <ErrorState error={settings.error} onRetry={() => void settings.refetch()} /> : !current ?
              <EmptyState title={t('notificationSettings.loadFailed')} action={<GhostBtn label={t('common.retry')} onPress={() => void settings.refetch()} />} /> :
              <Text variant="introCaption" color="redesign.secondary" style={styles.note}>
                {t(!capabilities.master ? 'g10.categoriesUnavailable' : !current.pushEnabled && (current.source === 'legacy' || current.source === 'migrated')
                  ? 'notificationSettings.migratedOff' : current.pushEnabled ? 'notificationSettings.inboxNote' : 'g10.masterPaused')}
              </Text>}
        </Card>
        <View style={styles.sectionHeading}>
          <Text variant="introHeading" color="redesign.ink" style={styles.flex}>{t('g10.categories')}</Text>
          <GhostBtn size="small" label={t('g10.enableAll')} disabled={!capabilities.categoryPatch}
            accessibilityHint={t('g10.categoriesUnavailable')} onPress={() => undefined} />
        </View>
        <Text variant="introCaption" color="redesign.secondary" style={styles.unavailable}>{t('g10.categoriesUnavailable')}</Text>
        <Card appearance="stitch" padded={false}>
          {notificationCategories.map((category, index) => <View key={category} style={[styles.category, index > 0 && styles.divider]}>
            <View style={[styles.categoryIcon, category === 'plan_ready' ? styles.successIcon : category === 'invite' || category === 'plan_changed' ? styles.infoIcon : styles.accentIcon]}>
              <Icon name={kindPresentation(category).icon} size={22} color={category === 'plan_ready' ? 'redesign.greenText' : category === 'invite' || category === 'plan_changed' ? 'redesign.violetText' : 'accent.onSoft'} />
            </View>
            <View style={styles.flex}>
              <Text variant="introHeading" color="redesign.ink">{t(`g10.category.${category}`)}</Text>
              <Text variant="introSmall" color="redesign.secondary">{t(`g10.categoryHint.${category}`)}</Text>
            </View>
            <Switch testID={`notification-category-${category}`} value={false} disabled={!capabilities.categoryPatch || !capabilities.categoryFields}
              accessibilityLabel={t(`g10.category.${category}`)} accessibilityHint={t('g10.categoriesUnavailable')}
              accessibilityState={{ disabled: true }} trackColor={trackColor} />
          </View>)}
        </Card>
        <View style={styles.quiet}>
          <View style={styles.row}>
            <Icon name="moon" size={20} color="redesign.violetText" />
            <Text variant="introHeading" color="redesign.ink" style={styles.flex}>{t('g10.quietHours')}</Text>
            <Switch testID="notification-quiet-hours" value={false} disabled={!capabilities.quietHours} accessibilityLabel={t('g10.quietHours')}
              accessibilityHint={t('g10.quietUnavailable')} accessibilityState={{ disabled: true }} trackColor={trackColor} />
          </View>
          <Text variant="introSmall" color="redesign.secondary">{t('g10.quietHint')}</Text>
          <Text variant="introCaption" color="redesign.secondary">{t('g10.quietUnavailable')}</Text>
        </View>
      </ScrollView>}
    <ResultSheet visible={result !== null} variant={result === 'success' ? 'success' : 'error'}
      title={t(result === 'success' ? 'g10.saved' : 'notificationSettings.saveFailed')}
      body={t(result === 'success' ? 'notificationSettings.inboxNote' : 'g10.saveRetryHint')}
      onClose={() => setResult(null)} primaryAction={{ label: t('common.close'), onPress: () => setResult(null) }}
      secondaryAction={result === 'error' && save.variables ? { label: t('notificationSettings.retrySave'),
        onPress: () => save.variables && saveMaster(save.variables.pushEnabled), loading: save.isPending } : undefined} />
  </Atmosphere>
}
