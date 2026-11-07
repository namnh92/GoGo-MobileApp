import type { ReactNode } from 'react'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { Atmosphere, IconBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { Icon } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './settings-page.style'

export function BuildVersion() {
  const { t } = useTranslation()
  const version = Constants.expoConfig?.version
  return version ? <Text variant="caption" color="text.secondary" style={styles.version}>{t('g11.version', { version, build: Constants.nativeBuildVersion ?? '' })}</Text> : null
}

export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  return <Atmosphere redesign>
    <View style={[styles.header, { paddingTop: insets.top, minHeight: insets.top + 64 }]}>
      <IconBtn accessibilityLabel={t('common.back')} onPress={() => router.back()}><Icon name="chevronLeft" /></IconBtn>
      <Text variant="title2" style={styles.title} accessibilityRole="header">{title}</Text>
      <HeaderNotificationButton testID="settings-bell" unreadDotTestID="settings-unread" showUnread={false} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}>{children}</ScrollView>
  </Atmosphere>
}
