import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import '@/shared/i18n'
import { NotificationClickRouter } from '@/shared/notifications/notification-click-router'
import { AppProviders } from '@/shared/providers/app-providers'
import { colors } from '@/shared/ui/tokens'

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <NotificationClickRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.neutral[50] },
        }}
      />
    </AppProviders>
  )
}
