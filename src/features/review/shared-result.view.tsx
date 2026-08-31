import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  detailToPlaceCard,
  toCandidateCard,
  toPlanSummary,
  useCurrentPlan,
  useCurrentSuggestions,
  usePlaceDetail,
  useRoom,
} from '@/shared/api'
import { formatMoney, perPerson } from '@/shared/pricing/money'
import { ErrorState } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { ResultSkeleton } from '@/shared/ui/skeleton.view'
import { IconShare } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './shared-result.style'

/** Score components are 0..1 from the ranking pipeline. */
const SCORE_MAX = 5
/** A zero component (a seed boost nobody used) is noise, not a result. */
const MIN_SHOWN_COMPONENT = 0.01

export default function SharedResultScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const suggestions = useCurrentSuggestions(roomId)
  const plan = useCurrentPlan(roomId)

  const winner = useMemo(() => {
    const candidates = (suggestions.data?.candidates ?? []).map(toCandidateCard)
    return candidates.sort((a, b) => a.rank - b.rank)[0]
  }, [suggestions.data])

  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  // The imagery is what makes a shared result worth looking at (spec §28).
  const winnerDetail = usePlaceDetail(winner?.placeId)

  if (room.isPending || suggestions.isPending || plan.isPending) {
    return (
      <View style={styles.root}>
        <ResultSkeleton />
      </View>
    )
  }

  if (room.isError || !room.data) {
    return (
      <View style={styles.root}>
        <ErrorState error={room.error} onRetry={() => void room.refetch()} />
      </View>
    )
  }

  const roomType = room.data.type
  const participantCount = room.data.participantCount

  /**
   * The pipeline's own explainable score parts, rendered as they are. The
   * screen used to show invented figures like "Budget harmony 94%"; these are
   * the numbers the ranking actually used.
   */
  const scoreParts = Object.entries(winner?.components ?? {})
    .filter(([, value]) => value >= MIN_SHOWN_COMPONENT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const matchScore = winner ? (winner.score * SCORE_MAX).toFixed(1) : null
  const winnerPhoto = winnerDetail.data ? detailToPlaceCard(winnerDetail.data).photoUrl : null

  async function share() {
    // Plain share via the native sheet (spec: no story/social-specific CTA).
    haptic('select')
    try {
      const line = [winner?.name, summary ? formatMoney(summary.costMax, summary.currency) : null]
        .filter(Boolean)
        .join(' · ')
      await Share.share({ message: `${t('sharedResult.title')}${line ? ` — ${line}` : ''}` })
    } catch {
      // user dismissed — nothing to do
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[6],
        }}
      >
        <Text style={styles.title}>
          {roomType === 'group'
            ? `${t('matchResult.groupTitle')} · ${participantCount} 👥`
            : t('sharedResult.title')}
        </Text>

        {/* The pipeline's match score, labelled as such — not a user rating. */}
        {matchScore ? (
          <View style={styles.scoreCard}>
            <Text style={styles.score}>{matchScore}</Text>
            <Text style={styles.scoreMax}>/ {SCORE_MAX}</Text>
            <Text style={styles.scoreCaption}>{t('sharedResult.matchScore')}</Text>
          </View>
        ) : null}

        {/* The place, not just its name — this is the card people send on. */}
        {winner ? (
          <View style={styles.heroCard}>
            <PlacePhoto
              placeId={winner.placeId}
              name={winner.name}
              uri={winnerPhoto}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroScrim} />
            <View style={styles.heroBody}>
              <Text style={styles.winnerName} numberOfLines={2}>{winner.name}</Text>
              {winnerDetail.data?.addressText ? (
                <Text style={styles.heroMeta} numberOfLines={1}>{winnerDetail.data.addressText}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {scoreParts.length > 0 ? (
          <View style={styles.darkCard}>
            <Text style={styles.caption}>{t('sharedResult.common', { context: roomType })}</Text>
            {scoreParts.map(([key, value]) => (
              <View key={key} style={styles.interestRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.interestHeader}>
                    <Text style={styles.interestLabel}>
                      {t(`suggestion.component.${key}`, { defaultValue: key })}
                    </Text>
                    <Text style={styles.interestPct}>{Math.round(value * 100)}%</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Facts from the plan, not invented compatibility percentages. */}
        {summary ? (
          <View style={styles.darkCard}>
            <Text style={styles.caption}>{t('sharedResult.stats')}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('sharedResult.stops')}</Text>
                <Text style={styles.statValue}>{summary.stops.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('datePlan.time')}</Text>
                <Text style={styles.statValue}>
                  {Math.floor(summary.durationMinutes / 60)}h {summary.durationMinutes % 60}m
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('datePlan.total')}</Text>
                <Text style={styles.statValue}>
                  {summary.uncertain ? '~' : ''}
                  {formatMoney(summary.costMax, summary.currency)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('sharedResult.perPerson')}</Text>
                <Text style={styles.statValue}>
                  ~{formatMoney(perPerson(summary.costMax, participantCount, summary.currency), summary.currency)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Sharing is what this screen is for, so it is the dominant action;
            one CTA into the native sheet, no social-network icon row. */}
        <Pressable
          accessibilityRole="button"
          onPress={share}
          style={({ pressed }) => [styles.shareBtn, styles.shareIsPrimary, pressed && { opacity: 0.9 }]}
        >
          <IconShare />
          <Text style={styles.shareLabel}>{t('sharedResult.share')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.shareLabel}>{t('sharedResult.nextDate')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
