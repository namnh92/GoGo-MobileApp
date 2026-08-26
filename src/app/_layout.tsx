import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import '@/shared/i18n'
import { colors } from '@/shared/ui/tokens'

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.neutral[50] },
          }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
