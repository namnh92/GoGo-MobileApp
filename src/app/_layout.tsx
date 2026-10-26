// First, before anything else evaluates: crash reporting (GoGo-MobileApp#336).
import '@/shared/observability/bootstrap'

import { Stack } from 'expo-router'
import { Platform } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'

import { DeferredLinkResumer } from '@/shared/acquisition/deferred-link-resumer'
import { TrackingConsentGate } from '@/shared/consent/tracking-consent-gate'
import '@/shared/i18n'
import { NotificationClickRouter } from '@/shared/notifications/notification-click-router'
import { RootErrorBoundary } from '@/shared/observability/root-error-boundary.view'
import { SentryScreenTag, screenTagLayout } from '@/shared/observability/screen-tag.view'
import { wrapRoot } from '@/shared/observability/sentry'
import { AppProviders } from '@/shared/providers/app-providers'
import { surface } from '@/shared/ui/tokens'

// Unistyles boots in the default accent; the saved one is an AsyncStorage read
// away. Hold the native splash until `AppProviders` has applied it (ADR-0009),
// so the first frame anyone sees is already in their colour. Failure to hold
// is not fatal — the worst case is the old behaviour, a brief default frame.
void SplashScreen.preventAutoHideAsync().catch(() => {})

function RootLayout() {
  return (
    // Outside the providers on purpose: it catches their failures too.
    <RootErrorBoundary>
      <AppProviders>
        <StatusBar style="dark" />
        <NotificationClickRouter />
        <DeferredLinkResumer />
        <TrackingConsentGate />
        <SentryScreenTag />
        <Stack
          screenLayout={screenTagLayout}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: surface.canvas },
          }}
        >
          {/* GoGo AI (#379): a page sheet over the current screen on iOS — swipe
              down closes it — and full screen on Android. The screen under it
              stays mounted, so closing returns to the same scroll position. */}
          <Stack.Screen
            name="assistant"
            options={{ presentation: Platform.OS === 'ios' ? 'pageSheet' : 'fullScreenModal', gestureEnabled: true }}
          />
        </Stack>
      </AppProviders>
    </RootErrorBoundary>
  )
}

export default wrapRoot(RootLayout)
