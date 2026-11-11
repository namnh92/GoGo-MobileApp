import { Stack, useRouter, useSegments } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { WizardHeaderOffset, WizardStep, type WizardStepKey } from '@/features/create-date/wizard-step.view'
import { Atmosphere } from '@/shared/ui/primitives'

// Deep links to later steps still get a first step beneath them for Back.
export const unstable_settings = { initialRouteName: 'type' }

export default function CreateLayout() {
  const router = useRouter()
  const segments = useSegments()
  const { theme } = useUnistyles()
  const [headerHeight, setHeaderHeight] = useState(0)
  const route = segments[segments.length - 1]
  const step: WizardStepKey = route === 'group-setup' || route === 'time' || route === 'budget' || route === 'mood' ? route : 'type'

  return <Atmosphere redesign>
    <View onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
      <WizardStep step={step} onBack={() => router.back()} />
    </View>
    <WizardHeaderOffset.Provider value={headerHeight}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface.canvas } }}>
        <Stack.Screen name="type" options={{ gestureEnabled: false }} />
      </Stack>
    </WizardHeaderOffset.Provider>
  </Atmosphere>
}
