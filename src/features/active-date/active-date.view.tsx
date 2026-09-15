import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isOffline,
  isRoomNotActive,
  toPlanSummary,
  useCheckinPlanStop,
  useCompletePlanStop,
  usePlan,
  usePlanStopPlaces,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { formatRange } from '@/shared/pricing/money'
import { EmptyState, ErrorState, StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { MapCanvas, type MapPin } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, Chip, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { PlanSkeleton } from '@/shared/ui/skeleton.view'
import { IconArrowRight, IconNavigation } from '@/shared/ui/icons'
import { glyph, spacing } from '@/shared/ui/tokens'

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

  // #251 — a room that is not `active` refuses stop completion and check-in.
  // That is the room's state, not the network, and a retry will not fix it.
  const roomNotActive = isRoomNotActive(completeStop.error) || isRoomNotActive(checkinStop.error)

  function backToPlan() {
    if (router.canGoBack()) router.back()
    else router.replace(`/plans/${planId}`)
  }

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
  const stopCost = stop ? formatRange(stop.costMin, stop.costMax, summary?.currency ?? 'VND') : null
  const stopPin: MapPin | null =
    stopPlace?.lat != null && stopPlace.lng != null
      ? { id: stopPlace.id, lat: stopPlace.lat, lng: stopPlace.lng, title: stopPlace.name }
      : null

  async function onDone() {
    if (!stop) return
    track('stop_completed', { placeId: stop.placeId, index: currentIndex + 1 })
    // Finishing a stop is the one commitment on this screen.
    haptic('success')
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
        ...(draft.photoKeys.length > 0 ? { photoKeys: draft.photoKeys } : {}),
      })
      track('stop_checkin_saved', {
        placeId: stop.placeId,
        rating: draft.rating,
        tags: draft.tags.join(','),
        photos: draft.photoKeys.length,
      })
    } catch (error) {
      // Check-in is optional; a failure must not block the date. A room that is
      // not in progress is different: every later write fails the same way, so
      // stay on this stop and say why.
      if (isRoomNotActive(error)) {
        setCheckinOpen(false)
        return
      }
    }
    advance()
  }

  if (plan.isPending) {
    return (
      <Atmosphere>
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
          <PlanSkeleton count={2} />
        </View>
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!summary) {
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
        <View style={styles.topRow}>
          <View>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.live}>{t('activeDate.live')}</Text>
            </View>
            <Text style={styles.stopCounter} accessibilityLiveRegion="polite">
              {t('activeDate.stop', { n: currentIndex + 1, total: stops.length })}
            </Text>
          </View>
          {/* The dots repeat the counter above, so they are decorative. */}
          <View
            style={styles.stepDots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
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
      </View>
      <StaleNotice error={plan.isError ? plan.error : null} onRetry={() => void plan.refetch()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <GlassCard style={styles.card}>
          <PlacePhoto placeId={stop.placeId} name={placeName} uri={null} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Chip label={t('activeDate.ongoing')} icon="📍" variant="positive" />
            </View>
            <Text style={styles.name}>{placeName}</Text>
            {address ? <Text style={styles.area}>{address}</Text> : null}

            <View style={styles.factRow}>
              {stop.arriveLabel ? <Chip label={stop.arriveLabel} icon="🕘" variant="default" /> : null}
              {stopCost ? <Chip label={stopCost} icon="💰" variant="default" /> : null}
            </View>

            {/* A real map of this stop, or a stated fallback — a strip captioned
                "view map" that shows no map and does not open one is worse. */}
            {stopPin ? (
              <MapCanvas
                pins={[stopPin]}
                style={styles.mapThumb}
                fallback={
                  <View style={styles.mapFallback}>
                    <Text style={styles.mapFallbackLabel}>{t('saved.mapUnavailable')}</Text>
                  </View>
                }
              />
            ) : null}

            {/* Finishing the stop is the dominant action; directions support it. */}
            <View style={styles.actions}>
              <PrimaryBtn
                label={
                  completeStop.isPending
                    ? t('activeDate.saving')
                    : nextStop
                      ? t('activeDate.doneStep')
                      : t('activeDate.finish')
                }
                onPress={onDone}
                loading={completeStop.isPending}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptic('select')
                  openGoogleMapsDirections(address ?? placeName)
                }}
                style={({ pressed }) => [styles.dirBtn, pressed && { opacity: 0.85 }]}
              >
                <IconNavigation />
                <Text style={styles.dirLabel}>{t('common.directions')}</Text>
              </Pressable>
            </View>

            {/* Completing a stop is a network write; say when it did not land,
                and why — connectivity is only one of the reasons. */}
            {roomNotActive ? (
              <View accessibilityLiveRegion="polite" style={styles.notActive}>
                <Text style={styles.failure}>{t('activeDate.notActive')}</Text>
                <GhostBtn label={t('activeDate.backToPlan')} onPress={backToPlan} />
              </View>
            ) : completeStop.isError ? (
              <Text accessibilityLiveRegion="polite" style={styles.failure}>
                {t(isOffline(completeStop.error) ? 'activeDate.completeFailed' : 'activeDate.completeFailedRetry')}
              </Text>
            ) : null}
          </View>
        </GlassCard>

        {nextStop && (
          <GlassCard style={styles.nextCard}>
            <Text style={{ fontSize: glyph.sm }}>📍</Text>
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
