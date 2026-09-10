import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass'
import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconBookmark, IconCalendar, IconHome, IconUser } from '@/shared/ui/icons'
import { colors, radius, spacing, glassFx, shadows, type } from '@/shared/ui/tokens'

// Floating glass dock (spec §45.1): detached from the screen edges, strong
// glass over whatever scrolls underneath.
export default function TabsLayout() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.coral,
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarStyle: {
          position: 'absolute',
          left: spacing[4],
          right: spacing[4],
          bottom: Math.max(insets.bottom - 8, 0) + spacing[3],
          height: 64,
          borderRadius: radius.hero,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          shadowColor: shadows.warm,
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.16,
          shadowRadius: 42,
          paddingTop: 8,
          paddingBottom: 10,
          marginHorizontal: spacing[4],
        },
        tabBarBackground: () =>
          Platform.OS === 'android' ? (
            <View style={[styles.dock, styles.dockSolid]} />
          ) : isLiquidGlassSupported ? (
            <LiquidGlassView
              effect="regular"
              colorScheme="light"
              interactive
              tintColor={glassFx.nativeTint}
              style={styles.dockGlass}
            />
          ) : (
            <View style={styles.dock}>
              <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.dockTint} />
            </View>
          ),
        // Deliberately below `caption`: a tab label is chrome, sized by the
        // platform's convention rather than the app's reading scale.
        tabBarLabelStyle: { fontSize: type.caption.fontSize - 1, fontWeight: '600', letterSpacing: 0.3 },
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

const styles = StyleSheet.create({
  dockGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.hero,
  },
  dock: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glassFx.borderLight,
  },
  dockSolid: { backgroundColor: colors.neutral[25] },
  dockTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: glassFx.dockTint,
  },
})
