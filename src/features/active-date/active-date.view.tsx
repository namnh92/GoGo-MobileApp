import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isForbidden,
  isOffline,
  isRetryable,
  isRoomNotActive,
  toPlanSummary,
  useCheckinPlanStop,
  useCompletePlanStop,
  usePlan,
  usePlanStopPlaces,
  useRoom,
  type PlanStopRow,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { formatRange } from '@/shared/pricing/money'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { MapCanvas, type MapPin } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, Chip, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { PlanSkeleton } from '@/shared/ui/skeleton.view'
import { IconArrowRight, IconNavigation } from '@/shared/ui/icons'
import { glyph, spacing } from '@/shared/ui/tokens'

import { CheckinSheet, type CheckinDraft } from './checkin-sheet.view'
import { styles } from './active-date.style'

/** What the check-in sheet is about, fixed when it opens so the plan cannot move it (#278). */
interface CheckinTarget {
  stop: PlanStopRow
  /** Closing the sheet ends the date: this stop was the last one, and it is completed. */
  finishesDate: boolean
}

export default function ActiveDateScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId, checkin } = useLocalSearchParams<{ planId: string; checkin?: string }>()

  const plan = usePlan(planId)
  const waitingForNetwork = useWaitingForNetwork(plan)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])
  // #251 — stop completion and check-in need an `active` room, so the room's
  // status decides whether this screen is live at all (rooms are persisted, so
  // this still reads offline).
  const room = useRoom(summary?.roomId)

  const completeStop = useCompletePlanStop(planId)
  const checkinStop = useCheckinPlanStop(planId)

  const deepLinked = checkin === '1' || checkin === 'bill'
  const [checkinOpen, setCheckinOpen] = useState(deepLinked)
  // #278 — completing a stop moves the first `planned` stop on while the sheet
  // is still open. Reading that live stop filed the check-in against the next
  // stop and, at the second-to-last stop, finished the date early. The sheet's
  // stop is captured when it opens instead.
  const [target, setTarget] = useState<CheckinTarget | null>(null)
  // Two taps can land before the button renders busy; one completion per stop.
  const completing = useRef(false)
  // The finished screen opens once, however the last sheet is closed.
  const finished = useRef(false)

  // #251 — a room that is not `active` refuses stop completion and check-in.
  // That is the room's state, not the network, and a retry will not fix it. A
  // refusal refetches the room: until that settles the refusal stands, and a
  // room confirmed active again means the host started in the meantime.
  const roomStatus = room.data?.status
  const refused = isRoomNotActive(completeStop.error) || isRoomNotActive(checkinStop.error)
  const confirmedActive = roomStatus === 'active' && !room.isFetching
  const notActive = (roomStatus !== undefined && roomStatus !== 'active') || (refused && !confirmedActive)
  // A deep link into a room that is not live waits for the room's answer rather
  // than showing a live screen that every write would refuse.
  const awaitingRoom = room.isFetching && roomStatus !== 'active' && !refused

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
  // screen is correct after a reload or on a second device. With every stop
  // done there is no current stop; it used to fall back to the first (#278).
  const currentIndex = stops.findIndex(stop => stop.status === 'planned')
  const stop = currentIndex >= 0 ? stops[currentIndex] : undefined
  const nextStop = stop
    ? stops.find((candidate, index) => index > currentIndex && candidate.status === 'planned')
    : undefined
  const placeName = stop ? (places.byPlaceId.get(stop.placeId)?.name ?? '') : ''

  // A deep link (`?checkin=1`) checks in at the stop in progress, captured the
  // first time the plan shows one. That stop is not completed, so closing its
  // sheet never ends the date.
  if (deepLinked && checkinOpen && target === null && stop) {
    setTarget({ stop, finishesDate: false })
  }
  const address = stop ? places.byPlaceId.get(stop.placeId)?.addressText : undefined

  const stopPlace = stop ? places.byPlaceId.get(stop.placeId) : undefined
  const stopCost = stop ? formatRange(stop.costMin, stop.costMax, summary?.currency ?? 'VND') : null
  const stopPin: MapPin | null =
    stopPlace?.lat != null && stopPlace.lng != null
      ? { id: stopPlace.id, lat: stopPlace.lat, lng: stopPlace.lng, title: stopPlace.name }
      : null

  async function onDone() {
    if (!stop || completing.current) return
    // Captured before the write: the plan update it triggers moves `stop` on.
    const completed: CheckinTarget = { stop, finishesDate: nextStop === undefined }
    completing.current = true
    track('stop_completed', { placeId: stop.placeId, index: currentIndex + 1 })
    // Finishing a stop is the one commitment on this screen.
    haptic('success')
    try {
      await completeStop.mutateAsync(stop.id)
      // A write landed, so an earlier check-in refusal no longer describes the room.
      checkinStop.reset()
      setTarget(completed)
      setCheckinOpen(true)
    } catch {
      // The plan query keeps the previous state; the user can retry.
    } finally {
      completing.current = false
    }
  }

  /** Closes the sheet, and finishes the date when the stop checked in was the last. */
  function moveOn(closed: CheckinTarget) {
    setCheckinOpen(false)
    if (!closed.finishesDate || finished.current) return
    finished.current = true
    track('date_completed', { stops: stops.length })
    router.replace(`/plans/${planId}/finished`)
  }

  function viewSummary() {
    router.replace(`/plans/${planId}/finished`)
  }

  /** Resolves true once the check-in landed; otherwise the sheet keeps its draft. */
  async function onSaveCheckin(saved: CheckinTarget, draft: CheckinDraft): Promise<boolean> {
    try {
      await checkinStop.mutateAsync({
        stopId: saved.stop.id,
        rating: draft.rating,
        tags: draft.tags,
        ...(draft.note ? { note: draft.note } : {}),
        ...(draft.photoKeys.length > 0 ? { photoKeys: draft.photoKeys } : {}),
      })
      track('stop_checkin_saved', {
        placeId: saved.stop.placeId,
        rating: draft.rating,
        tags: draft.tags.join(','),
        photos: draft.photoKeys.length,
      })
      completeStop.reset()
    } catch (error) {
      // A room that is not in progress refuses every later write the same way,
      // so stay on this stop and say why (#251). Any other failure keeps the
      // sheet and its draft: the sheet says why, Save retries what can be
      // retried, and Skip still moves the date on, so a check-in never blocks
      // it (#278).
      if (isRoomNotActive(error)) setCheckinOpen(false)
      return false
    }
    moveOn(saved)
    return true
  }

  // Only a failure a retry can fix asks for one.
  const checkinFailure =
    !checkinStop.isError || isRoomNotActive(checkinStop.error)
      ? null
      : isOffline(checkinStop.error)
        ? t('checkin.saveFailedOffline')
        : isForbidden(checkinStop.error)
          ? t('common.permissionDenied')
          : isRetryable(checkinStop.error)
            ? t('checkin.saveFailed')
            : t('checkin.saveRefused')

  // Keyed by stop, so each stop starts from a fresh draft, and the same sheet
  // and draft survive a plan or room update that swaps the layout around it
  // (the last stop done, here or on another phone).
  const sheet = target ? (
    <CheckinSheet
      key={target.stop.id}
      visible={checkinOpen}
      stop={target.stop}
      placeName={places.byPlaceId.get(target.stop.placeId)?.name ?? ''}
      pending={checkinStop.isPending}
      error={checkinFailure}
      onSave={draft => onSaveCheckin(target, draft)}
      onSkip={() => moveOn(target)}
    />
  ) : null

  if (plan.isPending || awaitingRoom) {
    return (
      <Atmosphere>
        {/* Nothing cached and offline: the paused read would keep the skeleton forever (#253). */}
        {waitingForNetwork ? (
          <OfflineState />
        ) : (
          <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
            <PlanSkeleton count={2} />
          </View>
        )}
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

  if (notActive) {
    const ended = roomStatus === 'completed'
    return (
      <Atmosphere>
        <View
          accessibilityLiveRegion="polite"
          style={[styles.notActive, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom }]}
        >
          <EmptyState
            title={t(
              ended
                ? 'activeDate.endedTitle'
                : roomStatus === 'cancelled'
                  ? 'plans.status.cancelled'
                  : roomStatus === 'expired'
                    ? 'plans.status.expired'
                    : 'activeDate.notActiveTitle',
            )}
            body={t(
              ended
                ? 'activeDate.endedBody'
                : roomStatus === 'cancelled'
                  ? 'datePlan.roomCancelled'
                  : roomStatus === 'expired'
                    ? 'datePlan.roomExpired'
                    : 'activeDate.notActive',
            )}
            action={
              <PrimaryBtn
                label={t(ended ? 'datePlan.viewSummary' : 'activeDate.backToPlan')}
                onPress={ended ? viewSummary : backToPlan}
                style={styles.notActiveCta}
              />
            }
          />
        </View>
        {/* Only an ended room still takes check-ins; there the sheet and its draft
            survive the room ending. Any other room refuses the save, so a check-in
            link opens nothing. */}
        {ended ? sheet : null}
      </Atmosphere>
    )
  }

  // Every stop is done: arriving back after the date, or the other phone
  // finished it. The summary is the way on; this stack has no header.
  if (!stop) {
    return (
      <Atmosphere>
        <View style={[styles.notActive, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom }]}>
          <EmptyState
            title={t('activeDate.allDoneTitle')}
            body={t('activeDate.allDoneBody')}
            action={<PrimaryBtn label={t('datePlan.viewSummary')} onPress={viewSummary} style={styles.notActiveCta} />}
          />
        </View>
        {sheet}
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
                and why — connectivity is only one of the reasons. A room that
                is not active never gets here: it renders its own state above. */}
            {completeStop.isError ? (
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

      {sheet}
    </Atmosphere>
  )
}
