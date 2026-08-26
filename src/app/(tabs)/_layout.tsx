import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { IconBookmark, IconCalendar, IconHome, IconUser } from '@/shared/ui/icons'
import { colors } from '@/shared/ui/tokens'

export default function TabsLayout() {
  const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.coral,
        tabBarInactiveTintColor: colors.neutral[300],
        tabBarStyle: {
          backgroundColor: 'rgba(252,251,248,0.96)',
          borderTopColor: colors.neutral[100],
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: ({ focused }) => <IconHome active={focused} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: t('tabs.plans'), tabBarIcon: ({ focused }) => <IconCalendar active={focused} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: t('tabs.saved'), tabBarIcon: ({ focused }) => <IconBookmark active={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ focused }) => <IconUser active={focused} /> }}
      />
    </Tabs>
  )
}
