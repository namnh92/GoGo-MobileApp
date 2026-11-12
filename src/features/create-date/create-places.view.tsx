import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { detailToPlaceCard, usePlaceDetail } from '@/shared/api'
import { MAX_SEED_PLACES, useRoom, useRoomStore, type SeedPlaceRef } from '@/shared/store/roomStore'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { SectionLabel } from '@/shared/ui/section-label.view'
import { pickerBudgetCeiling } from '@/shared/pricing/picker-budget-ceiling'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { useAppAreaStore } from '@/shared/location/app-area'
import { clearPickerScope, draftPickerScope, savePickerScope } from '@/shared/location/picker-scope'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import { useCreateRoomDraft } from './use-create-room-draft'
import { WizardScreen } from './wizard-step.view'
import { WizardStepHeader } from './wizard-step-header.view'
import { styles } from './create-places.style'

/** Facts stay in the query cache; restored drafts need only their id/name refs. */
function SeedPlaceCard({ seed, onRemove }: { seed: SeedPlaceRef; onRemove: () => void }) {
  const { t } = useTranslation()
  const detail = usePlaceDetail(seed.placeId)
  const place = detailToPlaceCard(detail.data ?? { id: seed.placeId, name: seed.name })
  return <PlaceCardSmall place={place} onRemove={onRemove} removeAccessibilityLabel={t('createPlaces.removePlace', { name: place.name })} />
}

export default function CreatePlacesScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
  const { seedPlaces, removeSeedPlace } = useRoom()
  const administrativeArea = useRoomStore(state => state.administrativeArea)
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const radiusM = useRoomStore(state => state.radiusM)
  const resolvedArea = useAppAreaStore(state => state.area)
  const resolvedScope = useAppAreaStore(state => state.scope)
  // The area lookup can lag behind a new native fix. Only use the area that
  // resolves this draft's position, as the location field does in step 1.
  const gpsArea = resolvedScope.status === 'ready' && resolvedScope.source === 'gps'
    && resolvedScope.position.lat === originLat && resolvedScope.position.lng === originLng
    ? resolvedArea : null
  const pickerScope = draftPickerScope({
    administrativeArea: administrativeArea ?? (radiusM === null ? gpsArea : null),
    originLat, originLng, radiusM,
  })
  const pickerScopeId = useRef<string | null>(null)
  const pickerOpening = useRef(false)
  const [isPickerOpening, setIsPickerOpening] = useState(false)
  useFocusEffect(useCallback(() => {
    pickerOpening.current = false
    setIsPickerOpening(false)
  }, [setIsPickerOpening]))
  useEffect(() => () => clearPickerScope(pickerScopeId.current), [])

  const { submit, error, pending } = useCreateRoomDraft()
  const draft = useRoomStore()
  const atCap = seedPlaces.length >= MAX_SEED_PLACES
  const limitHint = t('placeWizard.selectionLimitHint', { max: MAX_SEED_PLACES })
  return <WizardScreen step="places">
    <BlockingLoadingOverlay visible={pending} />
    <ScrollView testID="create-places-list" style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: footerInset + spacing[4] }]}>
        <WizardStepHeader title={t('createPlaces.title')} subtitle={t('createPlaces.body')} />
        <View style={styles.addPlace}>
          <Chip label={t('createPlaces.addPlace')} variant={pickerScope ? 'default' : 'disabled'} disabled={!pickerScope || isPickerOpening || atCap || pending} onPress={() => {
            if (pickerScope && !pickerOpening.current) {
              pickerOpening.current = true
              setIsPickerOpening(true)
              pickerScopeId.current = savePickerScope(pickerScope, pickerBudgetCeiling(draft))
              router.push({ pathname: '/places/search', params: { picker: '1', pickerScope: pickerScopeId.current } })
            }
          }} />
        </View>
        {!pickerScope ? <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">
          {t('createPlaces.seedScopeUnavailable')}
        </Text> : null}

        {atCap ? <Text accessibilityLiveRegion="polite" color="text.secondary">{limitHint}</Text> : null}
        {seedPlaces.length ? <View testID="create-places-selected" style={styles.group}>
          <SectionLabel>{t('createPlaces.selected', { count: seedPlaces.length })}</SectionLabel>
          <View testID="create-places-seed-list" style={styles.seedList}>
            {seedPlaces.map(place => <SeedPlaceCard key={place.placeId} seed={place} onRemove={() => removeSeedPlace(place.placeId)} />)}
          </View>
        </View> : null}
        {error ? <Text testID="create-places-create-error" variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
      <PrimaryBtn variant="stitch" label={pending ? t('createPlaces.creating') : t('createPlaces.cta')}
        onPress={() => void submit()} icon="arrowRight" loading={pending} disabled={pending} />
    </GlassBar>
  </WizardScreen>
}
