import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { Icon, IconBookmark, IconCalendar, IconChevronLeft, IconUser } from '@/shared/ui/icons'
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
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => goBackOrHome(router)} style={styles.back}>
        <IconChevronLeft />
      </Pressable>
      <View style={styles.titleBlock}>
        <View style={styles.titleRow}>
          <Text variant="savedCityTitle" color="redesign.ink" style={styles.title}>{title}</Text>
          {count != null ? <View style={styles.cityCount}><Text variant="savedMeta" color="redesign.savedAccent">{t('saved.cityCount', { count })}</Text></View> : null}
        </View>
        <Text variant="caption" color="redesign.savedMuted">{t('saved.citySubtitle')}</Text>
      </View>
      <View style={styles.bell}><HeaderNotificationButton testID="saved-city-bell" unreadDotTestID="saved-city-unread" /></View>
    </View>
  )} renderBottomBar={() => (
    <GlassBar testID="saved-city-tabs" style={[styles.dock, { paddingBottom: insets.bottom }]}>
      <View style={styles.tabs}>
        {tabs.map(({ key, href, icon: TabIcon }) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(`tabs.${key}`)} accessibilityState={{ selected: key === 'saved' }} onPress={() => router.replace(href)} style={styles.tab}>
          <TabIcon active={key === 'saved'} />
          <Text variant="caption" color={key === 'saved' ? 'redesign.primaryText' : 'text.secondary'}>{t(`tabs.${key}`)}</Text>
          {key === 'saved' ? <View style={styles.activeDot} /> : null}
        </Pressable>)}
      </View>
    </GlassBar>
  )} />
}
