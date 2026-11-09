import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Icon, IconBookmark, IconCalendar, IconUser } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { SavedPlacesScreen } from './saved.view'
import { styles } from './saved-city.style'

function DiscoveryTabIcon() {
  return <Icon name="compass" size={22} color="text.secondary" />
}

export default function SavedCityScreen() {
  const params = useLocalSearchParams<{ provinceCode?: string | string[]; cityName?: string | string[] }>()
  const router = useRouter()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const provinceCode = typeof params.provinceCode === 'string' ? params.provinceCode : ''
  const name = typeof params.cityName === 'string' ? params.cityName : ''
  const tabs = [
    { key: 'home', href: '/' as const, icon: DiscoveryTabIcon },
    { key: 'plans', href: '/(tabs)/plans' as const, icon: IconCalendar },
    { key: 'saved', href: '/(tabs)/saved' as const, icon: IconBookmark },
    { key: 'profile', href: '/(tabs)/profile' as const, icon: IconUser },
  ]

  return <SavedPlacesScreen city={{ provinceCode, name }} renderHeader={(title, count) => (
    <AppHeader title={title} subtitle={t('saved.citySubtitle')} onBack={() => goBackOrHome(router)} bellTestID="saved-city-bell" unreadDotTestID="saved-city-unread"
      titleAccessory={count != null ? <Text variant="savedMeta" color="accent.textMuted">{t('saved.cityCount', { count })}</Text> : undefined} />
  )} renderBottomBar={() => (
    <GlassBar testID="saved-city-tabs" style={[styles.dock, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabs}>
        {tabs.map(({ key, href, icon: TabIcon }) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(`tabs.${key}`)} accessibilityState={{ selected: key === 'saved' }} onPress={() => router.replace(href)} style={styles.tab}>
          <TabIcon active={key === 'saved'} />
          <Text variant="caption" color={key === 'saved' ? 'accent.text' : 'text.secondary'}>{t(`tabs.${key}`)}</Text>
          {key === 'saved' ? <View style={styles.activeDot} /> : null}
        </Pressable>)}
      </View>
    </GlassBar>
  )} />
}
