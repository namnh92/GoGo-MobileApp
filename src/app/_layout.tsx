import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'

import '@/shared/i18n'
import { NotificationClickRouter } from '@/shared/notifications/notification-click-router'
import { AppProviders } from '@/shared/providers/app-providers'
import { surface } from '@/shared/ui/tokens'

// Unistyles boots in the default accent; the saved one is an AsyncStorage read
// away. Hold the native splash until `AppProviders` has applied it (ADR-0009),
// so the first frame anyone sees is already in their colour. Failure to hold
// is not fatal — the worst case is the old behaviour, a brief default frame.
void SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <NotificationClickRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: surface.canvas },
        }}
      />
    </AppProviders>
  )
}
