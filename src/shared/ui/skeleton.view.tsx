import { useEffect, useState } from 'react'
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'

import { useReducedMotion } from '@/shared/ui/feedback'
import { Card } from '@/shared/ui/card.view'
import { GlassCard } from '@/shared/ui/primitives'
import { motion, radius, spacing } from '@/shared/ui/tokens'

import { styles } from './skeleton.style'

/**
 * Skeletons that match the layout they are standing in for (spec §30).
 *
 * A centred spinner tells the user only that something is happening; a skeleton
 * in the shape of the list tells them how much is coming and stops the page
 * jumping when it arrives. Spinners survive only where the layout genuinely is
 * not known yet.
 */

/** The whole tree is decorative — a screen reader should announce "loading"
 *  once, from the container, not read out fourteen grey rectangles. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const

function usePulse(): Animated.Value {
  const reduced = useReducedMotion()
  // Lazy initialiser, not a ref: the Animated.Value must survive re-renders
  // without being read during render.
  const [value] = useState(() => new Animated.Value(0.4))

  useEffect(() => {
    if (reduced) {
      // Reduced motion means no pulse at all — a flat tone, not a slower one.
      value.setValue(0.6)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.85, duration: motion.slow, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: motion.slow, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [reduced, value])

  return value
}

export function Skeleton({ width, height = 12, radius: r = 6, style }: {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const opacity = usePulse()
  return (
    <Animated.View
      {...HIDDEN}
      style={[styles.block, { width, height, borderRadius: r, opacity }, style]}
    />
  )
}

/** Mirrors the list PlaceCard (#293 §3): padded card, 96pt thumb, four lines. */
export function PlaceCardSkeleton() {
  return (
    <Card style={styles.listCard}>
      <Skeleton style={styles.listThumb} height={96} radius={radius.thumbnail} />
      <View style={styles.listBody}>
        <Skeleton width="70%" height={17} />
        <Skeleton width="55%" height={13} />
        <Skeleton width="45%" height={13} />
        <Skeleton width="35%" height={13} />
      </View>
    </Card>
  )
}

export function PlaceGridSkeleton() {
  return (
    <GlassCard style={styles.gridCard}>
      <Skeleton style={styles.gridThumb} height={undefined} radius={0} />
      <View style={styles.gridBody}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="55%" height={10} />
      </View>
    </GlassCard>
  )
}

export function PlaceDetailSkeleton() {
  return (
    <View {...HIDDEN}>
      <Skeleton style={styles.detailHero} height={undefined} radius={0} />
      <View style={styles.detailBody}>
        <Skeleton width="65%" height={24} />
        <Skeleton width="40%" />
        <Skeleton width="50%" />
        <Skeleton width="90%" height={56} radius={radius.compact} />
        <Skeleton width="100%" height={90} radius={radius.card} />
      </View>
    </View>
  )
}

export function RoomMemberSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.memberRow}>
          <Skeleton style={styles.memberAvatar} height={undefined} radius={24} />
          <View style={styles.memberLines}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="30%" height={10} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function PlanSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.planRow}>
          <View style={styles.planRail}>
            <Skeleton style={styles.planDot} height={undefined} radius={18} />
            {index < count - 1 ? <Skeleton style={styles.planLine} height={undefined} radius={1} /> : null}
          </View>
          <Skeleton style={styles.planCard} height={undefined} radius={radius.card} />
        </View>
      ))}
    </View>
  )
}

export function ResultSkeleton() {
  return (
    <View style={styles.screen}>
      <Skeleton style={styles.resultHero} height={undefined} radius={radius.hero} />
      <Skeleton width="60%" height={20} />
      <Skeleton width="100%" height={100} radius={radius.card} />
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="100%" height={52} radius={radius.button} />
      </View>
    </View>
  )
}

/** A list of place cards — the shape Home, Search and Plans all load into. */
export function PlaceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: count }).map((_, index) => (
        <PlaceCardSkeleton key={index} />
      ))}
    </View>
  )
}
