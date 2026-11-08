import type { ReactNode } from 'react'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { Atmosphere, IconBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './settings-page.style'

export function BuildVersion() {
  const { t } = useTranslation()
  const version = Constants.expoConfig?.version
  return version ? <Text variant="caption" color="text.secondary" style={styles.version}>{t('g11.version', { version, build: Constants.nativeBuildVersion ?? '' })}</Text> : null
}

export function SettingsPage({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  return <Atmosphere redesign>
    <View style={[styles.header, { paddingTop: insets.top, minHeight: insets.top + 64 }]}>
      <IconBtn style={styles.back} accessibilityLabel={t('common.back')} onPress={() => router.back()}><MaterialIcon name="arrowBack" size={24} /></IconBtn>
      <Text variant="introHeading" color="redesign.ink" style={styles.title} accessibilityRole="header" accessibilityLabel={title}>{title}</Text>
      <HeaderNotificationButton testID="settings-bell" unreadDotTestID="settings-unread" showUnread={false} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: footer ? insets.bottom + 96 : insets.bottom + spacing[6] }]}>{children}</ScrollView>
    {footer ? <GlassBar placement="floating" style={[styles.footer, { bottom: insets.bottom + spacing[2] }]}>{footer}</GlassBar> : null}
  </Atmosphere>
}
