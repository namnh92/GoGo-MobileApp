import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  detailToPlaceCard,
  formatDistance,
  formatMinuteOfDay,
  isRoomNotMatching,
  openStateFromHours,
  placePriceParts,
  roomCapabilities,
  toCandidateCard,
  useCastVote,
  useCurrentSuggestions,
  usePlaceDetail,
  useRoom,
  useRoomRealtime,
  useTaxonomyLabel,
  type VoteValue,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { EmptyState, ErrorState } from '@/shared/ui/async-state.view'
import { haptic, useReducedMotion } from '@/shared/ui/feedback'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, BackHeader, Chip, GhostBtn, glassStyles } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { colors, glyph, hitSlop, motion, overlay, spacing } from '@/shared/ui/tokens'

import { runStep, useRoomStepShown } from '@/shared/navigation/room-steps'

import { suggestionRunState } from './run-state'
import { SuggestionRunNotice } from './suggestion-run-notice.view'
import { styles } from './swipe.style'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'

const { brand, neutral } = colors

const SWIPE_THRESHOLD = 80
const FLY_DISTANCE = 500

/**
 * The deck's three actions map onto the three vote values the contract counts
 * (star = 2 points, yes = 1, no = 0). There is no "maybe" server-side, so the
 * middle action records a plain yes and the labels say so — a control that
 * looked non-committal but scored a point would misrepresent the tally.
 */
const ACTION_VOTES: Record<'pass' | 'yes' | 'star', VoteValue> = {
  pass: 'no',
  yes: 'yes',
  star: 'star',
}

type Action = keyof typeof ACTION_VOTES

export default function SwipeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const reducedMotion = useReducedMotion()

  const suggestions = useCurrentSuggestions(roomId)
  // Who may refresh an empty or stale run is the host (#199).
  const room = useRoom(roomId)
  // The lobby sends people here once per run (#198); back there, it must not again.
  const shownRunId = suggestions.data?.run?.id
  useRoomStepShown(roomId, shownRunId ? runStep(shownRunId) : null)
  const focused = useScreenFocused()
  useRoomRealtime(roomId, 'matching', { enabled: focused })
  const castVote = useCastVote(roomId)

  // #198 — voting closes when the room moves on: a plan was chosen, here or on
  // another phone, or the host reopened preferences. A deck for a closed vote
  // is a dead control; every vote on it is refused with ROOM_NOT_MATCHING. The
  // lobby routes on from where the room is, and the step memory above keeps it
  // from sending anyone back here.
  // Only a room read since this screen opened counts: a restored cache can be
  // an hour old, and would move someone off a vote that is still open.
  const [openedAt] = useState(() => Date.now())
  const roomMovedOn =
    room.isSuccess && room.dataUpdatedAt >= openedAt && room.data !== undefined && room.data.status !== 'matching'
  const [voteClosed, setVoteClosed] = useState(false)
  const leave = focused && (roomMovedOn || voteClosed)
  const left = useRef(false)
  useEffect(() => {
    if (!leave || left.current) return
    left.current = true
    router.replace(`/room/${roomId}`)
  }, [leave, roomId, router])
  const { resolve: taxonomyLabel } = useTaxonomyLabel()

  const [cardIndex, setCardIndex] = useState(0)
  const committing = useSharedValue(false)

  // Reanimated + gesture-handler: the drag runs on the UI thread, so the card
  // keeps up with the finger even while the next place detail is being fetched
  // (the PanResponder version ran the whole drag through the JS bridge).
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const candidates = useMemo(
    () => (suggestions.data?.candidates ?? []).map(toCandidateCard),
    [suggestions.data],
  )

  const card = candidates[cardIndex]
  // The candidate carries only name and score; the rest of the card comes from
  // the place, fetched per visible card so an empty deck costs nothing.
  const detail = usePlaceDetail(card?.placeId)

  // The visible card is the only state the deck has; the gesture is rebuilt for
  // each one, which is what keeps the vote and the card in step without a ref.
  const advance = useCallback(
    async (action: Action) => {
      const current = candidates[cardIndex]
      try {
        if (!current || suggestions.data?.run?.stale) return
        const result = await castVote.mutateAsync({ placeId: current.placeId, value: ACTION_VOTES[action] })
        track(action === 'pass' ? 'swipe_dislike' : 'swipe_like', { placeId: current.placeId })
        if (result.matched && result.planId) {
          router.replace(`/plans/${result.planId}`)
          return
        }
        const next = cardIndex + 1
        setCardIndex(next)
        if (next >= candidates.length) router.replace(`/room/${roomId}/match-result`)
      } catch (error) {
        // The vote closed under this card; no retry saves it (#198).
        if (isRoomNotMatching(error)) setVoteClosed(true)
        // Otherwise keep the failed card visible so the same vote can be retried.
      } finally {
        committing.set(false)
        translateX.set(0)
        translateY.set(0)
      }
    },
    [candidates, cardIndex, castVote, roomId, router, translateX, translateY, suggestions.data?.run?.stale, committing],
  )

  const commit = useCallback(
    (action: Action) => {
      if (committing.get() || suggestions.data?.run?.stale) return
      committing.set(true)
      // One tick per committed vote — the phone must not buzz through a drag.
      haptic(action === 'star' ? 'success' : 'select')

      if (reducedMotion) {
        advance(action)
        return
      }
      const target =
        action === 'yes'
          ? { x: FLY_DISTANCE, y: 0 }
          : action === 'pass'
            ? { x: -FLY_DISTANCE, y: 0 }
            : { x: 0, y: -FLY_DISTANCE }

      translateY.set(withTiming(target.y, { duration: motion.standard }))
      translateX.set(
        withTiming(target.x, { duration: motion.standard }, finished => {
          if (finished) runOnJS(advance)(action)
        }),
      )
    },
    [advance, reducedMotion, translateX, translateY, suggestions.data?.run?.stale, committing],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .activeOffsetY([-8, 8])
        .onUpdate(event => {
          translateX.set(event.translationX)
          translateY.set(event.translationY)
        })
        .onEnd(event => {
          if (event.translationX > SWIPE_THRESHOLD) runOnJS(commit)('yes')
          else if (event.translationX < -SWIPE_THRESHOLD) runOnJS(commit)('pass')
          else if (event.translationY < -SWIPE_THRESHOLD) runOnJS(commit)('star')
          else {
            translateX.set(withSpring(0))
            translateY.set(withSpring(0))
          }
        }),
    [commit, translateX, translateY],
  )

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { rotate: `${interpolate(translateX.get(), [-200, 0, 200], [-14, 0, 14])}deg` },
    ],
  }))
  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }))
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }))
  const starStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }))

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader
        onBack={() => router.back()}
        right={
          candidates.length > 0 ? (
            <Text style={styles.counter}>
              {Math.min(cardIndex + 1, candidates.length)} / {candidates.length}
            </Text>
          ) : undefined
        }
      />
    </View>
  )

  const runState = suggestionRunState(suggestions.data)
  const needsRole = runState === 'stale' || runState === 'empty'

  if (suggestions.isPending || (needsRole && room.isPending)) {
    return (
      <Atmosphere>
        {header}
        <View style={styles.deck}>
          <Skeleton style={styles.skeletonCard} height={undefined} radius={24} />
        </View>
      </Atmosphere>
    )
  }

  if (suggestions.isError) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={suggestions.error} onRetry={() => void suggestions.refetch()} />
      </Atmosphere>
    )
  }

  // No run yet is an empty state, not an error: the room is still collecting,
  // or the host has not started matching.
  if (runState === 'none') {
    return (
      <Atmosphere>
        {header}
        <EmptyState
          title={t('swipe.notReadyTitle')}
          body={t('swipe.notReadyBody')}
          action={<GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />}
        />
      </Atmosphere>
    )
  }

  // A stale run, or one that found nothing, is not "waiting for everyone" (#199).
  if (runState === 'stale' || runState === 'empty') {
    return (
      <Atmosphere>
        {header}
        {room.data ? (
          // A refetch that failed keeps the cached room, and with it the role.
          <SuggestionRunNotice
            roomId={roomId}
            state={runState}
            isHost={roomCapabilities(room.data).isHost}
            onRegenerated={() => setCardIndex(0)}
          />
        ) : (
          // With no room the role is unknown; a host must never be told to wait for the host.
          <ErrorState error={room.error} onRetry={() => void room.refetch()} />
        )}
      </Atmosphere>
    )
  }

  if (!card) {
    return (
      <Atmosphere>
        {header}
        <EmptyState title={t('swipe.doneTitle')} body={t('swipe.doneBody')} />
      </Atmosphere>
    )
  }

  const place = detail.data ? detailToPlaceCard(detail.data) : null
  const price = place ? placePriceParts(place) : null
  const open = openStateFromHours(detail.data?.hours)
  const hasHours = (detail.data?.hours ?? []).length > 0
  const categoryKey = (detail.data?.taxonomies ?? []).find(entry => entry.kind === 'category')?.key
  const categoryLabel = categoryKey ? taxonomyLabel('category', categoryKey) : null
  const openLabel = open.openNow
    ? formatMinuteOfDay(open.closesAtMinute)
      ? t('search.openUntil', { time: formatMinuteOfDay(open.closesAtMinute) })
      : t('common.open')
    : formatMinuteOfDay(open.opensAtMinute)
      ? t('search.closedOpens', { time: formatMinuteOfDay(open.opensAtMinute) })
      : t('common.closed')

  return (
    <Atmosphere>
      {header}
      <View style={{ alignItems: 'center', marginTop: -spacing[2], marginBottom: spacing[2] }}>
        <Text style={styles.header}>{t('swipe.header')}</Text>
        <Text style={styles.subheader}>{t('swipe.subheader')}</Text>
      </View>

      {castVote.isError ? (
        <Text accessibilityLiveRegion="polite" style={styles.subheader}>
          {t(isRoomNotMatching(castVote.error) ? 'swipe.votingClosed' : 'swipe.saveFailed')}
        </Text>
      ) : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(cardIndex / candidates.length) * 100}%` }]} />
      </View>

      <View style={styles.deck}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, glassStyles.card, cardStyle]}>
            <View style={styles.imageWrap}>
              <PlacePhoto
                placeId={card.placeId}
                name={card.name}
                uri={place?.photoUrl ?? null}
                style={StyleSheet.absoluteFill}
              />
              {/* A gradient, not a flat scrim: the top of the photo stays
                  bright while the title below keeps its contrast. */}
              <LinearGradient
                colors={['transparent', overlay.scrimLight, overlay.scrimStrong]}
                locations={[0.35, 0.65, 1]}
                style={styles.imageGradient}
              />

              {categoryLabel ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryLabel}>{categoryLabel}</Text>
                </View>
              ) : null}

              <Animated.View
                style={[styles.overlay, { left: 20, backgroundColor: brand.mint }, likeStyle]}
                pointerEvents="none"
              >
                <Text style={styles.overlayLabel}>{t('swipe.like')}</Text>
              </Animated.View>
              <Animated.View
                style={[styles.overlay, { right: 20, backgroundColor: brand.coral }, nopeStyle]}
                pointerEvents="none"
              >
                <Text style={styles.overlayLabel}>{t('swipe.pass')}</Text>
              </Animated.View>
              <Animated.View
                style={[styles.overlay, { alignSelf: 'center', backgroundColor: brand.lavender }, starStyle]}
                pointerEvents="none"
              >
                <Text style={styles.overlayLabel}>{t('swipe.star')}</Text>
              </Animated.View>

              <View style={styles.overImage}>
                <Text style={styles.overTitle} numberOfLines={2}>{card.name}</Text>
                {detail.data?.addressText ? (
                  <Text style={styles.overMeta} numberOfLines={1}>📍 {detail.data.addressText}</Text>
                ) : null}
              </View>
            </View>

            {/* The facts a swipe decision turns on, and nothing more (spec §17). */}
            <View style={styles.footer}>
              <View style={styles.factRow}>
                {price ? (
                  isStandalonePrice(price.unit) ? (
                    <Text style={styles.priceUnknown}>{t(priceUnitKey(price.unit))}</Text>
                  ) : (
                    <Text style={styles.price}>
                      {price.amount}
                      <Text style={styles.priceUnit}>{t(priceUnitKey(price.unit))}</Text>
                    </Text>
                  )
                ) : null}
                {place?.distanceM != null ? (
                  <Text style={styles.meta}>· {formatDistance(place.distanceM)}</Text>
                ) : null}
                {hasHours ? (
                  <>
                    <View
                      style={[styles.openDot, { backgroundColor: open.openNow ? brand.mint : neutral[300] }]}
                    />
                    <Text style={open.openNow ? styles.open : styles.closed}>{openLabel}</Text>
                  </>
                ) : null}
              </View>

              {card.reasonCodes.length > 0 ? (
                <View style={styles.tagRow}>
                  {/* Why this is here — the explainable part of the score. */}
                  {card.reasonCodes.slice(0, 2).map(code => (
                    <Chip
                      key={code}
                      label={t(`suggestion.reason.${code}`, { defaultValue: code })}
                      variant="info"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable
              onPress={() => commit('pass')}
              accessibilityRole="button"
              accessibilityLabel={t('swipe.passLabel')}
              disabled={castVote.isPending}
              accessibilityState={{ disabled: castVote.isPending, busy: castVote.isPending }}
              hitSlop={hitSlop}
              style={({ pressed }) => [styles.actionBtn, glassStyles.card, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <Text style={{ fontSize: glyph.sm }}>✕</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.passLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable
              onPress={() => commit('yes')}
              accessibilityRole="button"
              accessibilityLabel={t('swipe.likeLabel')}
              disabled={castVote.isPending}
              accessibilityState={{ disabled: castVote.isPending, busy: castVote.isPending }}
              hitSlop={hitSlop}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: brand.coral },
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
            >
              <Text style={{ fontSize: glyph.sm }}>❤️</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.likeLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable
              onPress={() => commit('star')}
              accessibilityRole="button"
              accessibilityLabel={t('swipe.starLabel')}
              disabled={castVote.isPending}
              accessibilityState={{ disabled: castVote.isPending, busy: castVote.isPending }}
              hitSlop={hitSlop}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnStar, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <Text style={{ fontSize: glyph.sm }}>⭐</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.starLabel')}</Text>
          </View>
        </View>
      </View>
    </Atmosphere>
  )
}
