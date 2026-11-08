import { AppHeader } from '@/shared/ui/app-header.view'
import type { ReactNode } from 'react'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Atmosphere } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
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
  return <Atmosphere redesign>
    <AppHeader showNotifications={false} title={title} onBack={() => router.back()} bellTestID="settings-bell" unreadDotTestID="settings-unread" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: footer ? insets.bottom + 96 : insets.bottom + spacing[6] }]}>{children}</ScrollView>
    {footer ? <GlassBar placement="floating" style={[styles.footer, { bottom: insets.bottom + spacing[2] }]}>{footer}</GlassBar> : null}
  </Atmosphere>
}
