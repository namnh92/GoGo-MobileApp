import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import '@/shared/i18n'
import { AppProviders } from '@/shared/providers/app-providers'
import { colors } from '@/shared/ui/tokens'

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.neutral[50] },
        }}
      />
    </AppProviders>
  )
}
