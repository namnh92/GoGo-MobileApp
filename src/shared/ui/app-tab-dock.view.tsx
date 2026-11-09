import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GlassBar } from './glass-bar.view'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './app-tab-dock.style'

/** The app destinations for a stack screen whose design retains the tab dock. */
const tabs = [
  { key: 'home', href: '/' as const, icon: 'explore' },
  { key: 'plans', href: '/(tabs)/plans' as const, icon: 'calendar' },
  { key: 'saved', href: '/(tabs)/saved' as const, icon: 'bookmark' },
  { key: 'profile', href: '/(tabs)/profile' as const, icon: 'user' },
] satisfies { key: string; href: string; icon: MaterialIconName }[]

export function AppTabDock({ active }: { active: typeof tabs[number]['key'] }) {
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return <GlassBar testID="app-tab-dock" style={{ paddingBottom: insets.bottom }}>
    <View style={styles.tabs}>
      {tabs.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={t(`tabs.${tab.key}`)}
        accessibilityState={{ selected: tab.key === active }} onPress={() => router.replace(tab.href)} style={styles.tab}>
        <MaterialIcon name={tab.icon} size={22} color={tab.key === active ? 'accent.primary' : 'text.secondary'} />
        <Text variant="caption" color={tab.key === active ? 'accent.primary' : 'text.secondary'} numberOfLines={1}>{t(`tabs.${tab.key}`)}</Text>
        {tab.key === active ? <View style={styles.activeDot} /> : null}
      </Pressable>)}
    </View>
  </GlassBar>
}
