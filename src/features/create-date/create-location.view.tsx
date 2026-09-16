import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AdministrativePicker } from '@/shared/administrative/administrative-picker.view'
import { useAdministrativeVersion } from '@/shared/administrative/queries'
import { administrativeAreaLabel, type AdministrativeSelection } from '@/shared/administrative/snapshot'
import { useMe } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { IconCheck, IconMapPin } from '@/shared/ui/icons'
import { Atmosphere, Chip, GlassCard, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './create-location.style'
import { WizardStep } from './wizard-step.view'

/** `null` means "anywhere" — the constraint simply omits `radiusM`. */
const RADIUS_OPTIONS: readonly (number | null)[] = [2000, 5000, 10000, null]

/**
 * ADM-202 (#207). Two independent ways to say where: the device position
 * (with a distance) or a canonical province/commune from the shared picker.
 * They exclude each other in the draft, because an area is a scope, not a
 * position — its centre never stands in for where the user is.
 */
export default function CreateLocationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { area: gpsLabel, setArea } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const administrativeArea = useRoomStore(state => state.administrativeArea)
  const originLat = useRoomStore(state => state.originLat)
  const { status } = useSession()
  const location = useCurrentLocation()
  const version = useAdministrativeVersion()
  const [radiusM, setRadiusM] = useState<number | null>(5000)
  const [staleArea, setStaleArea] = useState(false)

  const usingCurrent = originLat != null && administrativeArea === null

  // ADR-0022: the account area is a default offered only while this draft has
  // no location choice at all, and applied only by a tap. One whose dataset has
  // moved on is not offered; the account screen asks for a reselection instead.
  const me = useMe({ enabled: status === 'user' })
  const homeArea = me.data?.homeAdministrativeArea ?? null
  const offerHomeArea =
    homeArea !== null && homeArea.status === 'current' && administrativeArea === null && originLat === null

  function chooseArea(value: AdministrativeSelection | null) {
    setStaleArea(false)
    setArea('')
    patchDraft({ administrativeArea: value, originLat: null, originLng: null })
  }

  function useHomeArea() {
    if (!homeArea) return
    chooseArea({
      datasetVersion: homeArea.datasetVersion,
      provinceCode: homeArea.provinceCode,
      provinceName: homeArea.provinceName,
      communeCode: homeArea.communeCode ?? null,
      communeName: homeArea.communeName ?? null,
    })
    track('profile_prefill_used', { field: 'homeArea' })
  }

  async function useDeviceLocation() {
    const result = await location.request()
    if (result.status !== 'granted') return // the copy below points at the area picker
    setStaleArea(false)
    setArea(result.label ?? '')
    patchDraft({ administrativeArea: null, originLat: result.lat, originLng: result.lng })
  }

  function next() {
    const published = version.data?.datasetVersion
    // The server refuses a replaced dataset too; saying it here keeps the user
    // on the step where it can be fixed.
    if (administrativeArea && published && administrativeArea.datasetVersion !== published) {
      setStaleArea(true)
      return
    }
    // A distance only means something from a position.
    patchDraft({ radiusM: usingCurrent ? radiusM : null })
    router.push('/create/time')
  }

  // The subtitle follows the draft, not the last fix: once an area replaces
  // the position, the card is an unselected offer again (#207). The hook keeps
  // its `granted` state after that, so it cannot decide what the card says.
  const currentSubtitle =
    location.state.status === 'asking'
      ? t('createLocation.locating')
      : usingCurrent
        ? gpsLabel || t('createLocation.locatedNoLabel')
        : t('createLocation.useMyLocation')

  return (
    <Atmosphere>
      <WizardStep step="location" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('createLocation.title')}</Text>
        <Text style={styles.body}>{t('createLocation.body')}</Text>

        {/* Current location — the permission is asked here, on tap, never on
            launch, and every refusal leaves the area picker as the way on. */}
        <Pressable
          onPress={useDeviceLocation}
          disabled={location.state.status === 'asking'}
          accessibilityRole="radio"
          accessibilityState={{ selected: usingCurrent, busy: location.state.status === 'asking' }}
        >
          <GlassCard style={styles.rowCard}>
            <View style={[styles.rowIcon, { backgroundColor: colors.brand.coralSoft }]}>
              <IconMapPin />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('createLocation.current')}</Text>
              <Text style={styles.rowSub}>{currentSubtitle}</Text>
            </View>
            {location.state.status === 'asking' ? <ActivityIndicator /> : usingCurrent && <IconCheck />}
          </GlassCard>
        </Pressable>

        {location.state.status === 'denied' || location.state.status === 'unavailable' ? (
          <Text accessibilityLiveRegion="polite" style={styles.locationFallback}>
            {location.state.status === 'denied'
              ? t('createLocation.permissionDenied')
              : t('createLocation.locationUnavailable')}
          </Text>
        ) : null}

        {usingCurrent ? (
          <>
            <Text style={styles.sectionTitle}>{t('createLocation.maxDistance')}</Text>
            <View style={styles.grid}>
              {RADIUS_OPTIONS.map(option => {
                const active = radiusM === option
                const label = option === null ? t('createLocation.anywhere') : `${option / 1000} km`
                return (
                  <Pressable
                    key={label}
                    onPress={() => setRadiusM(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.radiusBtn, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
                  >
                    <Text style={[styles.radiusLabel, { color: active ? colors.neutral[0] : colors.neutral[500] }]}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t('createLocation.areaTitle')}</Text>
        {offerHomeArea ? (
          <View style={styles.prefillRow}>
            <Chip
              icon="🏠"
              label={t('createLocation.useHomeArea', { area: administrativeAreaLabel(homeArea) })}
              variant="info"
              onPress={useHomeArea}
            />
          </View>
        ) : null}
        <AdministrativePicker value={administrativeArea} onChange={chooseArea} />
        {staleArea ? (
          <Text accessibilityLiveRegion="polite" style={styles.locationFallback}>
            {t('administrative.changed')}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
        <PrimaryBtn label={t('common.continue')} onPress={next} />
      </View>
    </Atmosphere>
  )
}
