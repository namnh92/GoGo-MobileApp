import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  formatRangeForPlace,
  toCandidateCard,
  useCastVote,
  useCurrentSuggestions,
  usePlaceDetail,
  useRoomRealtime,
  type VoteValue,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, BackHeader, GhostBtn, TagChip, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './swipe.style'

const { brand } = colors

const SWIPE_THRESHOLD = 80

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

export default function SwipeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const suggestions = useCurrentSuggestions(roomId)
  useRoomRealtime(roomId, 'matching')
  const castVote = useCastVote(roomId)

  const [cardIndex, setCardIndex] = useState(0)
  const [position] = useState(() => new Animated.ValueXY())
  // Mutated only inside event/animation callbacks, never during render.
  const indexRef = useRef(0)

  const candidates = useMemo(
    () => (suggestions.data?.candidates ?? []).map(toCandidateCard),
    [suggestions.data],
  )

  const card = candidates[cardIndex]
  // The candidate carries only name and score; the rest of the card comes from
  // the place, fetched per visible card so an empty deck costs nothing.
  const detail = usePlaceDetail(card?.placeId)

  const rotate = position.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-16deg', '0deg', '16deg'] })
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' })
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const starOpacity = position.y.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) flyOut('yes')
        else if (gesture.dx < -SWIPE_THRESHOLD) flyOut('pass')
        else if (gesture.dy < -SWIPE_THRESHOLD) flyOut('star')
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
      },
    }),
  )

  function advance(action: keyof typeof ACTION_VOTES) {
    const current = candidates[indexRef.current]
    if (current) {
      // The vote is optimistic and idempotent, so the deck never waits on it.
      castVote.mutate({ placeId: current.placeId, value: ACTION_VOTES[action] })
      track(action === 'pass' ? 'swipe_dislike' : 'swipe_like', { placeId: current.placeId })
    }

    indexRef.current += 1
    setCardIndex(indexRef.current)
    position.setValue({ x: 0, y: 0 })

    if (indexRef.current >= candidates.length) {
      setTimeout(() => router.replace(`/room/${roomId}/waiting`), 300)
    }
  }

  function flyOut(action: keyof typeof ACTION_VOTES) {
    const target = action === 'yes' ? { x: 400, y: 0 } : action === 'pass' ? { x: -400, y: 0 } : { x: 0, y: -400 }
    Animated.timing(position, { toValue: target, duration: 200, useNativeDriver: false }).start(() => advance(action))
  }

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

  if (suggestions.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
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
  if (!suggestions.data?.run || candidates.length === 0) {
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

  if (!card) {
    return (
      <Atmosphere>
        {header}
        <EmptyState title={t('swipe.doneTitle')} body={t('swipe.doneBody')} />
      </Atmosphere>
    )
  }

  const priceLabel = formatRangeForPlace(detail.data)

  return (
    <Atmosphere>
      {header}
      <View style={{ alignItems: 'center', marginTop: -spacing[2], marginBottom: spacing[2] }}>
        <Text style={styles.header}>{t('swipe.header')}</Text>
        <Text style={styles.subheader}>{t('swipe.subheader')}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(cardIndex / candidates.length) * 100}%` }]} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[2] }}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, glassStyles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
        >
          <View style={{ height: '58%' }}>
            <PlacePhoto placeId={card.placeId} name={card.name} uri={null} style={StyleSheet.absoluteFill} />
            <View style={styles.imageScrim} />
            <Animated.View style={[styles.overlay, { left: 20, backgroundColor: brand.mint, opacity: likeOpacity, transform: [{ rotate: '-15deg' }] }]}>
              <Text style={styles.overlayLabel}>{t('swipe.like')}</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, { right: 20, backgroundColor: brand.coral, opacity: nopeOpacity, transform: [{ rotate: '15deg' }] }]}>
              <Text style={styles.overlayLabel}>{t('swipe.pass')}</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, { alignSelf: 'center', backgroundColor: brand.lavender, opacity: starOpacity }]}>
              <Text style={styles.overlayLabel}>{t('swipe.star')}</Text>
            </Animated.View>
            {detail.data?.addressText ? (
              <View style={styles.areaRow}>
                <Text style={styles.areaLabel} numberOfLines={1}>📍 {detail.data.addressText}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ padding: spacing[4] }}>
            <Text style={styles.cardTitle}>{card.name}</Text>
            <View style={styles.tagRow}>
              {/* Why this is here — the explainable part of the score. */}
              {card.reasonCodes.slice(0, 2).map(code => (
                <TagChip key={code} label={t(`suggestion.reason.${code}`, { defaultValue: code })} />
              ))}
              {priceLabel ? <TagChip label={priceLabel} color="coral" /> : null}
            </View>
            {detail.data?.description ? (
              <Text style={styles.desc} numberOfLines={2}>{detail.data.description}</Text>
            ) : null}
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('pass')} accessibilityLabel={t('swipe.passLabel')} style={[styles.actionBtn, glassStyles.card]}>
              <Text style={{ fontSize: 24 }}>✕</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.passLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('yes')} accessibilityLabel={t('swipe.likeLabel')} style={[styles.actionBtn, { backgroundColor: brand.coral }]}>
              <Text style={{ fontSize: 24 }}>❤️</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.likeLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('star')} accessibilityLabel={t('swipe.starLabel')} style={[styles.actionBtn, { width: 48, height: 48, backgroundColor: brand.lavenderSoft }]}>
              <Text style={{ fontSize: 20 }}>⭐</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.starLabel')}</Text>
          </View>
        </View>
      </View>
    </Atmosphere>
  )
}
