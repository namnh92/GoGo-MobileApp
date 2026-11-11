import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { Sheet } from '@/shared/ui/sheet.view'
import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import type { AdministrativeSelection } from '@/shared/administrative/snapshot'
import { useAppAreaStore } from './app-area'
import { styles } from './current-area-sheet.style'

type CurrentAreaSheetProps = {
  visible: boolean
  /** Recovery can offer manual selection without another GPS attempt. */
  mode?: 'default' | 'manualOnly'
  onClose: () => void
  onApplied: () => void
  /** Wizard-only recovery; other callers retain the inline warning. */
  onLocationFailure?: () => void
  /** Wait for native dismissal before presenting a recovery dialog. */
  onClosed?: () => void
  selection?: { value: AdministrativeSelection | null; onApply: (value: AdministrativeSelection) => void }
}

/** Shared #524 picker. A controlled selection edits a caller draft without changing the app-wide area. */
export function CurrentAreaSheet({ visible, onClose, onApplied, selection, onLocationFailure, onClosed, mode = 'default' }: CurrentAreaSheetProps) {
  const { t } = useTranslation()
  const location = useCurrentLocation()
  const appArea = useAppAreaStore()
  const area = selection ? selection.value : appArea.area
  const setArea = appArea.setArea
  const [valid, setValid] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [draftArea, setDraftArea] = useState(area)
  const [draftSource, setDraftSource] = useState({ visible, area })
  if (draftSource.visible !== visible || draftSource.area !== area) {
    setDraftSource({ visible, area })
    if (visible) { setDraftArea(area); setValid(false); setChoosing(false) }
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
    if (!mounted.current || !visibleRef.current) return
    if (result.status === 'granted') { onApplied(); onClose() }
    else if (result.status === 'denied' || result.status === 'unavailable') onLocationFailure?.()
  }
  function confirm() {
    if (!draftArea || !valid) return
    if (selection) selection.onApply(draftArea)
    else setArea(draftArea)
    onApplied()
    onClose()
  }
  return <Sheet swipeToClose appearance="discovery" visible={visible} onClose={onClose} onClosed={onClosed} testID="discovery-location-sheet"
    size={choosing ? 'full' : 'content'} scroll={false}
    footer={!choosing ? <SheetActions>
      {!selection ? <SecondaryBtn variant="area" label={t('administrative.clear')} disabled={location.state.status === 'asking'} onPress={() => { setDraftArea(null); setArea(null) }} /> : null}
      <PrimaryBtn variant="area" label={t('areaPicker.confirm')} disabled={!draftArea || !valid || (!selection && location.state.status === 'asking')} onPress={confirm} />
    </SheetActions> : undefined}
    header={!choosing ? <AppHeader variant="sheet" safeArea={false} title={t('home.chooseArea')}
      rightAction={<AppHeaderAction accessibilityLabel={t('common.close')} onPress={onClose}><MaterialIcon name="close" /></AppHeaderAction>} /> : undefined}>
    <View style={choosing ? styles.list : styles.content}>
      {!choosing && !selection && mode !== 'manualOnly' ? <>
        <SecondaryBtn variant="area" leadingIcon="location" label={t('home.useLocation')} onPress={() => void requestDeviceLocation()} loading={location.state.status === 'asking'} />
        {location.state.status === 'denied' || location.state.status === 'unavailable' ? <Text accessibilityLiveRegion="polite" color="text.secondary">{t(location.state.status === 'denied' ? 'createLocation.permissionDenied' : 'createLocation.locationUnavailable')}</Text> : null}
      </> : null}
      {visible ? <AdministrativePicker embedded value={draftArea} onChange={setDraftArea} onValidityChange={setValid} onChoosingChange={setChoosing} /> : null}
    </View>
  </Sheet>
}
