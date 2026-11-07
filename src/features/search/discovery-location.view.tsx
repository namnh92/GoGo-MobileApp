import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { Sheet } from '@/shared/ui/sheet.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { useDiscoveryAreaStore } from './discovery-area-store'
import { styles } from './discovery-location.style'

/** Device permission and search area are public; account management stays gated. */
export function DiscoveryLocationSheet({ visible, onClose, onApplied }: { visible: boolean; onClose: () => void; onApplied: () => void }) {
  const { t } = useTranslation()
  const location = useCurrentLocation()
  const { area, setArea } = useDiscoveryAreaStore()
  const [draftArea, setDraftArea] = useState(area)
  const [draftSource, setDraftSource] = useState({ visible, area })
  if (draftSource.visible !== visible || draftSource.area !== area) {
    setDraftSource({ visible, area })
    if (visible) setDraftArea(area)
  }
  const mounted = useRef(true)
  const visibleRef = useRef(visible)
  useLayoutEffect(() => {
    visibleRef.current = visible
  }, [visible])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  async function requestDeviceLocation() {
    const result = await location.request()
    if (mounted.current && visibleRef.current && result.status === 'granted') { onApplied(); onClose() }
  }
  return <Sheet swipeToClose appearance="discovery" visible={visible} onClose={onClose} testID="discovery-location-sheet"
    header={<View style={styles.header}><Text variant="introHeading">{t('home.chooseArea')}</Text><IconBtn accessibilityLabel={t('common.close')} onPress={onClose}><MaterialIcon name="close" /></IconBtn></View>}>
    <View style={styles.content}>
      <SecondaryBtn label={t('home.useLocation')} onPress={() => void requestDeviceLocation()} loading={location.state.status === 'asking'} />
      {location.state.status === 'denied' || location.state.status === 'unavailable' ? <Text accessibilityLiveRegion="polite" color="text.secondary">{t(location.state.status === 'denied' ? 'createLocation.permissionDenied' : 'createLocation.locationUnavailable')}</Text> : null}
      <AdministrativePicker value={draftArea} onChange={setDraftArea} />
      <PrimaryBtn label={t('discovery.useArea')} disabled={!draftArea || location.state.status === 'asking'} onPress={() => { setArea(draftArea); onApplied(); onClose() }} />
    </View>
  </Sheet>
}
