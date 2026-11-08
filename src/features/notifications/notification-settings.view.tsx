import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

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

export default function NotificationSettingsScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { status } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const capabilities = notificationCapabilities()
  const trackColor = { true: theme.accent.primary, false: theme.redesign.highest }

  return <Atmosphere redesign>
    <AppHeader showNotifications={false} title={t('g10.settingsTitle')} onBack={() => goBackOrHome(router)} />
    {status !== 'user' ? <EmptyState title={t('notifications.signInTitle')} body={t('notifications.signInBody')}
      action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> :
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <NotificationSwitchSection />
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
  </Atmosphere>
}
