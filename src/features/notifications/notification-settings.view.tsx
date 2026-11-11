import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { useNotificationSettings, useSetNotificationSettings } from '@/shared/api'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { useSession } from '@/shared/providers/session-provider'
import { AppHeader } from '@/shared/ui/app-header.view'
import { EmptyState } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { notificationCapabilities, notificationCategories } from './notification-capabilities'
import { kindPresentation } from './notification-kind'
import { NotificationSwitchSection } from './notification-switch.view'
import { styles } from './notification-settings.style'

function NotificationCategorySection() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const settings = useNotificationSettings()
  const save = useSetNotificationSettings()
  const capabilities = notificationCapabilities(settings.data)
  const disabled = !capabilities.categories || save.isPending || settings.isFetching || settings.isPaused
  const categories = settings.data?.categories
  const count = notificationCategories.filter(key => categories?.[key] === true).length
  const enableAll = () => {
    if (!disabled) save.mutate({ categories: { invite: true, preference_reminder: true, plan_ready: true, plan_changed: true, date_reminder: true } })
  }
  const changeCategory = (category: typeof notificationCategories[number], enabled: boolean) => {
    const changes = { invite: { invite: enabled }, preference_reminder: { preference_reminder: enabled },
      plan_ready: { plan_ready: enabled }, plan_changed: { plan_changed: enabled }, date_reminder: { date_reminder: enabled } }
    if (!disabled) save.mutate({ categories: changes[category] })
  }

  return <>
      <BlockingLoadingOverlay visible={save.isPending} />
    <View style={styles.sectionHeading}>
      <Text variant="introHeading" color="text.primary" style={styles.flex}>{t('g10.categories')}</Text>
      <GhostBtn size="small" label={t('g10.enableAll')} disabled={!!disabled} loading={save.isPending} onPress={enableAll} />
    </View>
    {capabilities.categories ? <Text variant="introCaption" color="text.secondary">{t('g10.categoryCount', { count })}</Text>
      : <Text variant="introCaption" color="text.secondary" style={styles.unavailable}>{t('g10.categoriesUnavailable')}</Text>}
    {capabilities.categories && !settings.data?.pushEnabled ? <Text variant="introSmall" color="text.secondary">{t('g10.masterPaused')}</Text> : null}
    <Card appearance="stitch" padded={false}>
      {notificationCategories.map((category, index) => <View key={category} style={[styles.category, index > 0 && styles.divider]}>
        <View style={[styles.categoryIcon, category === 'plan_ready' ? styles.successIcon : category === 'invite' || category === 'plan_changed' ? styles.infoIcon : styles.accentIcon]}>
          <Icon name={kindPresentation(category).icon} size={22} color={category === 'plan_ready' ? 'status.successText' : category === 'invite' || category === 'plan_changed' ? 'status.infoText' : 'accent.onSoft'} />
        </View>
        <View style={styles.flex}>
          <Text variant="introHeading" color="text.primary">{t(`g10.category.${category}`)}</Text>
          <Text variant="introSmall" color="text.secondary">{t(`g10.categoryHint.${category}`)}</Text>
        </View>
        <Switch testID={`notification-category-${category}`} value={categories?.[category] ?? false} disabled={!!disabled}
          onValueChange={enabled => changeCategory(category, enabled)}
          accessibilityLabel={t(`g10.category.${category}`)} accessibilityHint={!capabilities.categories ? t('g10.categoriesUnavailable') : undefined}
          accessibilityState={{ disabled: !!disabled, busy: save.isPending }} trackColor={{ true: theme.accent.primary, false: theme.surface.highest }} />
      </View>)}
    </Card>
    {save.isError && save.variables?.categories ? <View accessibilityLiveRegion="polite">
      <Text variant="introSmall" color="status.dangerText">{t('notificationSettings.saveFailed')}</Text>
      <GhostBtn label={t('notificationSettings.retrySave')} disabled={!!disabled} onPress={() => { if (!disabled && save.variables) save.mutate(save.variables) }} />
    </View> : null}
  </>
}

function QuietHoursSection() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const settings = useNotificationSettings()
  const save = useSetNotificationSettings()
  const capabilities = notificationCapabilities(settings.data)
  const quietHours = settings.data?.quietHours
  let timezone = quietHours?.timezone
  if (!timezone) {
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { timezone = null }
  }
  const disabled = !capabilities.quietHours || save.isPending || !!settings.isFetching || !!settings.isPaused
    || (!quietHours?.enabled && !timezone)
  const hint = !capabilities.quietHours ? t('g10.quietUnavailable') : !timezone ? t('g10.quietTimezoneUnavailable') : undefined
  const variables = save.variables
  return <View style={styles.quiet}>
    <BlockingLoadingOverlay visible={save.isPending} />
    <View style={styles.row}>
      <Icon name="moon" size={20} color="status.infoText" />
      <Text variant="introHeading" color="text.primary" style={styles.flex}>{t('g10.quietHours')}</Text>
      <Switch testID="notification-quiet-hours" value={quietHours?.enabled ?? false} disabled={disabled}
        onValueChange={enabled => {
          if (!disabled) save.mutate({ quietHours: enabled ? { enabled, timezone: timezone! } : { enabled } })
        }}
        accessibilityLabel={t('g10.quietHours')} accessibilityHint={hint}
        accessibilityState={{ disabled, busy: save.isPending }}
        trackColor={{ true: theme.accent.primary, false: theme.surface.highest }} />
    </View>
    <Text variant="introSmall" color="text.secondary">{t('g10.quietHint')}</Text>
    {hint ? <Text variant="introCaption" color="text.secondary">{hint}</Text> : null}
    {save.isError && variables && 'quietHours' in variables ? <View accessibilityLiveRegion="polite">
      <Text variant="introSmall" color="status.dangerText">{t('notificationSettings.saveFailed')}</Text>
      <GhostBtn label={t('notificationSettings.retrySave')} disabled={disabled}
        onPress={() => { if (!disabled) save.mutate(variables) }} />
    </View> : null}
  </View>
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation()
  const { status } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return <Atmosphere redesign>
    <AppHeader showNotifications={false} title={t('g10.settingsTitle')} onBack={() => goBackOrHome(router)} />
    {status !== 'user' ? <EmptyState title={t('notifications.signInTitle')} body={t('notifications.signInBody')}
      action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> :
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <NotificationSwitchSection />
        <NotificationCategorySection />
        <QuietHoursSection />
      </ScrollView>}
  </Atmosphere>
}
