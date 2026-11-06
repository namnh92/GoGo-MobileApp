import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { Atmosphere, BackHeader, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { useDiscoveryAreaStore } from './discovery-area-store'
import { styles } from './discovery-location.style'

/** Device permission and search area are public; account management stays gated. */
export default function DiscoveryLocationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const location = useCurrentLocation()
  const { area, setArea } = useDiscoveryAreaStore()
  const [draftArea, setDraftArea] = useState(area)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  async function requestDeviceLocation() {
    const result = await location.request()
    if (mounted.current && result.status === 'granted') { setArea(null); router.back() }
  }
  return <Atmosphere redesign>
    <View style={{ paddingTop: insets.top }}><BackHeader title={t('home.chooseArea')} onBack={() => router.back()} /></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom }]}>
      <SecondaryBtn label={t('home.useLocation')} onPress={() => void requestDeviceLocation()} loading={location.state.status === 'asking'} />
      {location.state.status === 'denied' || location.state.status === 'unavailable' ? <Text accessibilityLiveRegion="polite" color="text.secondary">{t(location.state.status === 'denied' ? 'createLocation.permissionDenied' : 'createLocation.locationUnavailable')}</Text> : null}
      <AdministrativePicker value={draftArea} onChange={setDraftArea} />
      <PrimaryBtn label={t('discovery.useArea')} disabled={location.state.status === 'asking'} onPress={() => { setArea(draftArea); router.back() }} />
    </ScrollView>
  </Atmosphere>
}
