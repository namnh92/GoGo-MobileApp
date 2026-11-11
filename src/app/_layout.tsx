// First, before anything else evaluates: crash reporting (GoGo-MobileApp#336).
import '@/shared/observability/bootstrap'

import { Stack } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import * as SplashScreen from 'expo-splash-screen'

import { DeferredLinkResumer } from '@/shared/acquisition/deferred-link-resumer'
import { TrackingConsentGate } from '@/shared/consent/tracking-consent-gate'
import { DevicePromotionsGate } from '@/shared/notifications/device-promotions-gate'
import { OnboardingPermissionGate } from '@/shared/notifications/onboarding-permission-gate'
import '@/shared/i18n'
import { NotificationClickRouter } from '@/shared/notifications/notification-click-router'
import { RootErrorBoundary } from '@/shared/observability/root-error-boundary.view'
import { SentryScreenTag, screenTagLayout } from '@/shared/observability/screen-tag.view'
import { wrapRoot } from '@/shared/observability/sentry'
import { AppProviders } from '@/shared/providers/app-providers'
import { ThemedStatusBar } from '@/shared/ui/themed-status-bar.view'

// Unistyles boots in the default accent; the saved one is an AsyncStorage read
// away. Hold the native splash until `AppProviders` has applied it (ADR-0009),
// so the first frame anyone sees is already in their colour. Failure to hold
// is not fatal — the worst case is the old behaviour, a brief default frame.
void SplashScreen.preventAutoHideAsync().catch(() => {})

function RootLayout() {
  const { theme } = useUnistyles()
  return (
    // Outside the providers on purpose: it catches their failures too.
    <RootErrorBoundary>
      <AppProviders>
        <ThemedStatusBar />
        <NotificationClickRouter />
        <DeferredLinkResumer />
        <TrackingConsentGate />
        <OnboardingPermissionGate />
        <DevicePromotionsGate />
        <SentryScreenTag />
        <Stack
          screenLayout={screenTagLayout}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.surface.canvas },
          }}
        >
          {/* Wizard Back owns the exit prompt; root swipe must not bypass it. */}
          <Stack.Screen name="create" options={{ gestureEnabled: false }} />
          {/* A normal stack card keeps the conversation mounted beneath destinations. */}
          <Stack.Screen
            name="assistant"
            options={{ presentation: 'card', gestureEnabled: true }}
          />
        </Stack>
      </AppProviders>
    </RootErrorBoundary>
  )
}

export default wrapRoot(RootLayout)
