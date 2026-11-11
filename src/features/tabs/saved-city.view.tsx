import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { Text } from '@/shared/ui/text'

import { SavedPlacesScreen } from './saved.view'

export default function SavedCityScreen() {
  const params = useLocalSearchParams<{ provinceCode?: string | string[]; cityName?: string | string[] }>()
  const router = useRouter()
  const { t } = useTranslation()
  const provinceCode = typeof params.provinceCode === 'string' ? params.provinceCode : ''
  const name = typeof params.cityName === 'string' ? params.cityName : ''
  return <SavedPlacesScreen city={{ provinceCode, name }} renderHeader={(title, count) => (
    <AppHeader title={title} subtitle={t('saved.citySubtitle')} onBack={() => goBackOrHome(router)} bellTestID="saved-city-bell" unreadDotTestID="saved-city-unread"
      titleAccessory={count != null ? <Text variant="savedMeta" color="accent.textMuted">{t('saved.cityCount', { count })}</Text> : undefined} />
  )} />
}
