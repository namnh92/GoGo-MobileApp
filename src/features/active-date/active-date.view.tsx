import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  toPlanSummary,
  useCheckinPlanStop,
  useCompletePlanStop,
  usePlan,
  usePlanStopPlaces,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { formatRange } from '@/shared/pricing/money'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { MapCanvas, type MapPin } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, GlassCard, TagChip } from '@/shared/ui/primitives'
import { IconArrowRight, IconNavigation } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'

import { CheckinSheet, type CheckinDraft } from './checkin-sheet.view'
import { styles } from './active-date.style'

export default function ActiveDateScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId, checkin } = useLocalSearchParams<{ planId: string; checkin?: string }>()

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])

  const completeStop = useCompletePlanStop(planId)
  const checkinStop = useCheckinPlanStop(planId)

  const [checkinOpen, setCheckinOpen] = useState(checkin === '1' || checkin === 'bill')

  // A live Modal overlays other screens — close it whenever we lose focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setTimeout(() => setCheckinOpen(false), 0)
      }
    }, []),
  )

  const stops = summary?.stops ?? []
  // Progress comes from the server's stop status, not a local counter, so the
  // screen is correct after a reload or on a second device.
  const currentIndex = Math.max(
    0,
    stops.findIndex(stop => stop.status === 'planned'),
  )
  const stop = stops[currentIndex]
  const nextStop = stops[currentIndex + 1]
  const placeName = stop ? (places.byPlaceId.get(stop.placeId)?.name ?? '') : ''
  const address = stop ? places.byPlaceId.get(stop.placeId)?.addressText : undefined

  const stopPlace = stop ? places.byPlaceId.get(stop.placeId) : undefined
  const stopPin: MapPin | null =
    stopPlace?.lat != null && stopPlace.lng != null
      ? { id: stopPlace.id, lat: stopPlace.lat, lng: stopPlace.lng, title: stopPlace.name }
      : null

  async function onDone() {
    if (!stop) return
    track('stop_completed', { placeId: stop.placeId, index: currentIndex + 1 })
    try {
      await completeStop.mutateAsync(stop.id)
      setCheckinOpen(true)
    } catch {
      // The plan query keeps the previous state; the user can retry.
    }
  }

  function advance() {
    setCheckinOpen(false)
    if (!nextStop) {
      track('date_completed', { stops: stops.length })
      router.replace(`/plans/${planId}/finished`)
    }
  }

  async function onSaveCheckin(draft: CheckinDraft) {
    if (!stop) return
    try {
      await checkinStop.mutateAsync({
        stopId: stop.id,
        rating: draft.rating,
        tags: draft.tags,
        ...(draft.note ? { note: draft.note } : {}),
      })
      track('stop_checkin_saved', {
        placeId: stop.placeId,
        rating: draft.rating,
        tags: draft.tags.join(','),
      })
    } catch {
      // Check-in is optional; a failure must not block the date.
    }
    advance()
  }

  if (plan.isPending) {
    return (
      <Atmosphere>
        <LoadingState />
      </Atmosphere>
    )
  }

  if (plan.isError || !summary) {
    return (
      <Atmosphere>
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      </Atmosphere>
    )
  }

  if (!stop) {
    return (
      <Atmosphere>
        <EmptyState title={t('activeDate.allDoneTitle')} body={t('activeDate.allDoneBody')} />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing[3] }]}>
        <View>
          <Text style={styles.live}>{t('activeDate.live')}</Text>
          <Text style={styles.stopCounter}>
            {t('activeDate.stop', { n: currentIndex + 1, total: stops.length })}
          </Text>
        </View>
        <View style={styles.stepDots}>
          {stops.map((candidate, index) => (
            <View
              key={candidate.id}
              style={[
                styles.stepDot,
                index === currentIndex && styles.stepDotActive,
                candidate.status === 'completed' && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <GlassCard style={styles.card}>
          <PlacePhoto placeId={stop.placeId} name={placeName} uri={null} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text style={{ fontSize: 24 }}>📍</Text>
              <TagChip label={t('activeDate.ongoing')} color="green" />
            </View>
            <Text style={styles.name}>{placeName}</Text>
            {address ? <Text style={styles.area}>{address}</Text> : null}

            {/* A real map of this stop, or nothing — a strip captioned "view
                map" that shows no map and does not open one is worse. */}
            {stopPin ? (
              <MapCanvas pins={[stopPin]} style={styles.mapThumb} />
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openGoogleMapsDirections(address ?? placeName)}
                style={styles.dirBtn}
              >
                <IconNavigation />
                <Text style={styles.dirLabel}>{t('common.directions')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDone}
                disabled={completeStop.isPending}
                style={styles.doneBtn}
              >
                <Text style={styles.doneLabel}>
                  {completeStop.isPending
                    ? t('activeDate.saving')
                    : nextStop
                      ? t('activeDate.doneStep')
                      : t('activeDate.finish')}
                </Text>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        {nextStop && (
          <GlassCard style={styles.nextCard}>
            <Text style={{ fontSize: 24 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextCaption}>{t('activeDate.next')}</Text>
              <Text style={styles.nextName}>{places.byPlaceId.get(nextStop.placeId)?.name ?? ''}</Text>
              <Text style={styles.nextMeta}>
                {[nextStop.arriveLabel, formatRange(nextStop.costMin, nextStop.costMax, summary.currency)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <IconArrowRight />
          </GlassCard>
        )}
      </ScrollView>

      <CheckinSheet
        visible={checkinOpen}
        stop={stop}
        placeName={placeName}
        pending={checkinStop.isPending}
        onSave={onSaveCheckin}
        onSkip={advance}
      />
    </Atmosphere>
  )
}
