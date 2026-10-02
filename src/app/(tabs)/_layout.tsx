import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { GlassBar, TAB_BAR_HEIGHT } from '@/shared/ui/glass-bar.view'
import { IconBookmark, IconCalendar, IconHome, IconUser } from '@/shared/ui/icons'

/** Static, so it can go to the navigator's own background slot as-is. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const

/**
 * Tab bar (#296, #293 §5): flush with the bottom edge, `TAB_BAR_HEIGHT` above
 * the safe area, glass behind (`GlassBar`, hairline on top). Absolute, so the
 * tab screens scroll under it and pad their end with `useBottomBarInset()`.
 *
 * Active: filled icon + `accent.primary` label. Inactive: outline icon +
 * `text.secondary` label. Labels are `caption` — the scale's smallest size, not
 * one below it.
 */
export default function TabsLayout() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent.primary,
        tabBarInactiveTintColor: theme.text.secondary,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          // The hairline is GlassBar's; the navigator's own border and shadow go.
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => <GlassBar testID="tab-bar-glass" style={FILL} />,
        tabBarLabelStyle: theme.type.caption,
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
