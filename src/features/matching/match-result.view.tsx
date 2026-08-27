import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  roomCapabilities,
  toCandidateCard,
  useCurrentPlan,
  useCurrentSuggestions,
  useGenerateSuggestions,
  useFinalizeVotes,
  useRoom,
  useRoomRealtime,
  type CandidateCard,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { formatMoney } from '@/shared/pricing/money'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { IconCheck, IconZap } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './match-result.style'

export default function MatchResultScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const suggestions = useCurrentSuggestions(roomId)
  const plan = useCurrentPlan(roomId)
  useRoomRealtime(roomId, 'matching')

  const finalize = useFinalizeVotes(roomId)
  const regenerate = useGenerateSuggestions(roomId)

  const capabilities = roomCapabilities(room.data)
  const roomType = room.data?.type ?? 'couple'
  const participantCount = room.data?.participantCount ?? 2

  const candidates = useMemo(
    () => (suggestions.data?.candidates ?? []).map(toCandidateCard).sort((a, b) => a.rank - b.rank),
    [suggestions.data],
  )
  const winner: CandidateCard | undefined = candidates[0]

  const tally = useMemo(() => {
    const progress = suggestions.data?.votes?.progress ?? []
    return new Map(progress.map(entry => [entry.placeId, entry]))
  }, [suggestions.data])

  async function onFinalize() {
    try {
      const result = await finalize.mutateAsync({})
      track('match_generated', { finalized: true })
      if (result.planId) router.replace(`/plans/${result.planId}`)
    } catch {
      // The error state renders below; the ranking stays usable.
    }
  }

  function viewPlan(planId: string) {
    track('date_plan_viewed')
    router.push(`/plans/${planId}`)
  }

  if (room.isPending || suggestions.isPending) {
    return (
      <Atmosphere>
        <LoadingState />
      </Atmosphere>
    )
  }

  if (room.isError || suggestions.isError) {
    return (
      <Atmosphere>
        <ErrorState
          error={room.error ?? suggestions.error}
          onRetry={() => {
            void room.refetch()
            void suggestions.refetch()
          }}
        />
      </Atmosphere>
    )
  }

  if (!winner) {
    return (
      <Atmosphere>
        <EmptyState
          title={t('matchResult.emptyTitle')}
          body={t('matchResult.emptyBody')}
          action={<GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />}
        />
      </Atmosphere>
    )
  }

  const existingPlanId = plan.data?.id
  const winnerTally = tally.get(winner.placeId)
  // A run built before the last constraint edit is stale and must not be shown
  // as the current answer (RULE-CORE-006).
  const isStale = suggestions.data?.run?.stale ?? false

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[3], paddingBottom: spacing[8] }}>
        <View style={styles.hero}>
          <PlacePhoto placeId={winner.placeId} name={winner.name} uri={null} style={StyleSheet.absoluteFill} />
          <View style={styles.heroScrim} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>
              ⚡ {roomType === 'group' ? t('matchResult.groupTitle') : t('matchResult.matchBadge')}
            </Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle}>{winner.name}</Text>
            {roomType === 'group' && winnerTally ? (
              <Text style={styles.heroVotes}>
                {t('matchResult.groupVotes', {
                  likes: (winnerTally.yes ?? 0) + (winnerTally.star ?? 0),
                  total: participantCount,
                  vetoes: winnerTally.no ?? 0,
                })}
              </Text>
            ) : null}
            {plan.data?.totals ? (
              <Text style={styles.heroMeta}>
                ⏱ {Math.round((plan.data.totals.durationMinutes ?? 0) / 60)}h · 💰{' '}
                {formatMoney(plan.data.totals.costMax ?? 0, plan.data.totals.currency ?? 'VND')}
              </Text>
            ) : null}
          </View>
        </View>

        {isStale ? (
          <Text style={styles.staleWarning}>⚠️ {t('matchResult.stale')}</Text>
        ) : null}

        {/* Why this one — the explainable part of the score, straight from the
            pipeline rather than a written-in list. */}
        <GlassCard style={styles.reasonCard}>
          <View style={styles.reasonTitleRow}>
            <IconZap />
            <Text style={styles.reasonTitle}>{t('matchResult.whyTitle')}</Text>
          </View>
          {winner.reasonCodes.map(code => (
            <View key={code} style={styles.reasonRow}>
              <IconCheck />
              <Text style={styles.reasonLabel}>{t(`suggestion.reason.${code}`, { defaultValue: code })}</Text>
            </View>
          ))}
          {winner.reasonCodes.length === 0 ? (
            <Text style={styles.reasonLabel}>{t('matchResult.noReasons')}</Text>
          ) : null}
        </GlassCard>

        {/* The rest of the ranking, with its real tally. */}
        {candidates.length > 1 ? (
          <View style={styles.runnersUp}>
            <Text style={styles.runnersUpTitle}>{t('matchResult.runnersUp')}</Text>
            {candidates.slice(1, 5).map(candidate => {
              const entry = tally.get(candidate.placeId)
              return (
                <GlassCard key={candidate.placeId} style={styles.runnerRow}>
                  <Text style={styles.runnerName} numberOfLines={1}>{candidate.name}</Text>
                  <Text style={styles.runnerPoints}>
                    {t('matchResult.points', { n: entry?.points ?? candidate.points })}
                  </Text>
                </GlassCard>
              )
            })}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[5], gap: spacing[2] }}>
          {existingPlanId ? (
            <PrimaryBtn label={t('matchResult.viewPlan')} onPress={() => viewPlan(existingPlanId)} />
          ) : capabilities.canFinalize ? (
            // Host-only, and server-enforced: a member sending this gets 403.
            <PrimaryBtn
              label={finalize.isPending ? t('matchResult.finalizing') : t('matchResult.finalize')}
              onPress={onFinalize}
              loading={finalize.isPending}
            />
          ) : (
            <Text style={styles.waitingHost}>{t('matchResult.waitingHost')}</Text>
          )}

          {capabilities.canRegenerate ? (
            <GhostBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.another')}
              onPress={() => regenerate.mutate()}
            />
          ) : null}

          {finalize.isError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t('matchResult.finalizeFailed')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
