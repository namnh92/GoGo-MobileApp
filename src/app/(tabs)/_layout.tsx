import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { colors } from '@/shared/ui/tokens'

export default function TabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.coral,
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarStyle: { backgroundColor: colors.neutral[25], borderTopColor: colors.neutral[100] },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="plans" options={{ title: t('tabs.plans') }} />
      <Tabs.Screen name="saved" options={{ title: t('tabs.saved') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  )
}
