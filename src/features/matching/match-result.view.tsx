import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isApiError,
  isStaleRanking,
  detailToPlaceCard,
  formatDistance,
  formatMinuteOfDay,
  openStateFromHours,
  placePriceParts,
  roomCapabilities,
  toCandidateCard,
  usePlaceDetail,
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
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { EmptyState, ErrorState } from '@/shared/ui/async-state.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, Chip, GhostBtn, GlassCard, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { ResultSkeleton } from '@/shared/ui/skeleton.view'
import { IconCheck, IconZap } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './match-result.style'
import { regenerateFailure, suggestionRunState } from './run-state'
import { SuggestionRunNotice } from './suggestion-run-notice.view'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'

export default function MatchResultScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const suggestions = useCurrentSuggestions(roomId)
  const plan = useCurrentPlan(roomId)
  useRoomRealtime(roomId, 'matching', { enabled: useScreenFocused() })

  const finalize = useFinalizeVotes(roomId)
  const regenerate = useGenerateSuggestions(roomId)

  const capabilities = roomCapabilities(room.data)
  const roomType = room.data?.type ?? 'couple'
  const participantCount = room.data?.participantCount ?? 2

  const decisionMode = room.data?.decisionMode
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const finalizing = useRef(false)
  const candidates = useMemo(
    () => (suggestions.data?.candidates ?? []).map(toCandidateCard).sort((a, b) => a.rank - b.rank),
    [suggestions.data],
  )
  const winner: CandidateCard | undefined = decisionMode === 'host'
    ? candidates.find(candidate => candidate.placeId === selectedPlaceId) ?? candidates[0]
    : decisionMode === 'vote'
      ? [...candidates].filter(candidate => {
          const row = suggestions.data?.votes?.progress?.find(v => v.placeId === candidate.placeId)
          return row && (row.yes ?? 0) + (row.no ?? 0) + (row.star ?? 0) > 0
        }).sort((a, b) => {
          const votes = suggestions.data?.votes?.progress ?? []
          return (votes.find(v => v.placeId === b.placeId)?.points ?? 0) -
            (votes.find(v => v.placeId === a.placeId)?.points ?? 0) || a.rank - b.rank
        })[0] ?? candidates[0]
      : candidates[0]
  // The candidate carries a name and a score; price, distance and opening
  // hours are place facts, so the winner's detail is fetched for them.
  const winnerDetail = usePlaceDetail(winner?.placeId)

  const tally = useMemo(() => {
    const progress = suggestions.data?.votes?.progress ?? []
    return new Map(progress.map(entry => [entry.placeId, entry]))
  }, [suggestions.data])

  // Stale when the server says so on read, or when it refused a finalize for
  // that reason before this screen's copy of the ranking caught up (#198).
  const staleRejected = isStaleRanking(finalize.error)
  const isStale = Boolean(
    suggestions.data?.run?.stale || candidates.some(candidate => candidate.stale) || staleRejected,
  )
  const hasVotes = (suggestions.data?.votes?.progress ?? []).some(entry => (entry.yes ?? 0) + (entry.no ?? 0) + (entry.star ?? 0) > 0)
  async function onFinalize() {
    if (finalizing.current || isStale || room.data?.status !== 'matching' || !capabilities.isHost || !winner) return
    if (decisionMode !== 'host' && (decisionMode !== 'vote' || !hasVotes)) return
    finalizing.current = true
    try {
      const result = await finalize.mutateAsync(decisionMode === 'host' ? { placeId: winner.placeId } : {})
      track('match_generated', { finalized: true })
      if (result.planId) router.replace(`/plans/${result.planId}`)
    } catch {
      // The error state renders below; the ranking stays usable.
    } finally {
      finalizing.current = false
    }
  }

  function viewPlan(planId: string) {
    track('date_plan_viewed')
    router.push(`/plans/${planId}`)
  }

  function onRegenerate() {
    // A fresh run answers the refusal; the old finalize error must not outlive it.
    regenerate.mutate(undefined, { onSuccess: () => finalize.reset() })
  }

  if (room.isPending || suggestions.isPending) {
    return (
      <Atmosphere>
        <ResultSkeleton />
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
    // No candidate is "not started yet" only when there is no run at all (#199).
    const runState = suggestionRunState(suggestions.data)
    return (
      <Atmosphere>
        {runState === 'stale' || runState === 'empty' ? (
          <SuggestionRunNotice roomId={roomId} state={runState} isHost={capabilities.isHost} />
        ) : (
          <EmptyState
            title={t('matchResult.emptyTitle')}
            body={t('matchResult.emptyBody')}
            action={<GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />}
          />
        )}
      </Atmosphere>
    )
  }

  const existingPlanId = plan.data?.id
  const winnerTally = tally.get(winner.placeId)

  const winnerPlace = winnerDetail.data ? detailToPlaceCard(winnerDetail.data) : null
  const winnerOpen = openStateFromHours(winnerDetail.data?.hours)
  const winnerPrice = winnerPlace ? placePriceParts(winnerPlace) : null
  const winnerFacts: { key: string; label: string; icon?: string; variant: 'default' | 'positive' | 'warning' }[] = []
  if (winnerPrice) {
    winnerFacts.push({
      key: 'price',
      icon: '💰',
      variant: 'default',
      label: isStandalonePrice(winnerPrice.unit)
        ? t(priceUnitKey(winnerPrice.unit))
        : `${winnerPrice.amount}${t(priceUnitKey(winnerPrice.unit))}`,
    })
  }
  if (winnerPlace?.distanceM != null) {
    winnerFacts.push({ key: 'distance', icon: '📍', variant: 'default', label: formatDistance(winnerPlace.distanceM) ?? '' })
  }
  if ((winnerDetail.data?.hours ?? []).length > 0) {
    const closes = formatMinuteOfDay(winnerOpen.closesAtMinute)
    const opens = formatMinuteOfDay(winnerOpen.opensAtMinute)
    winnerFacts.push({
      key: 'open',
      variant: winnerOpen.openNow ? 'positive' : 'warning',
      label: winnerOpen.openNow
        ? closes
          ? t('search.openUntil', { time: closes })
          : t('common.open')
        : opens
          ? t('search.closedOpens', { time: opens })
          : t('common.closed'),
    })
  }
  // A run built before the last constraint edit is stale and must not be shown
  // as the current answer (RULE-CORE-006).


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

        {/* The facts behind the verdict, not just the verdict (spec §19). */}
        {winnerFacts.length > 0 ? (
          <View style={styles.factRow}>
            {winnerFacts.map(fact => (
              <Chip key={fact.key} label={fact.label} icon={fact.icon} variant={fact.variant} />
            ))}
          </View>
        ) : null}

        {isStale ? (
          <Text accessibilityLiveRegion="polite" style={styles.staleWarning}>
            ⚠️ {t('matchResult.staleCause')}
          </Text>
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
            {candidates.filter(candidate => candidate.placeId !== winner.placeId).slice(0, 4).map(candidate => {
              const entry = tally.get(candidate.placeId)
              return (
                <Pressable
                  key={candidate.placeId}
                  accessibilityRole="button"
                  accessibilityLabel={candidate.name}
                  onPress={() => decisionMode === 'host' ? setSelectedPlaceId(candidate.placeId) : router.push(`/places/${candidate.placeId}`)}
                  style={styles.runnerAction}
                >
                  <GlassCard style={styles.runnerRow}>
                    <View style={styles.runnerRank}>
                      <Text style={styles.runnerRankLabel}>{candidate.rank}</Text>
                    </View>
                    <Text style={styles.runnerName} numberOfLines={1}>{candidate.name}</Text>
                    <Text style={styles.runnerPoints}>
                      {t('matchResult.points', { n: entry?.points ?? candidate.points })}
                    </Text>
                  </GlassCard>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[5], gap: spacing[2] }}>
          {existingPlanId ? (
            <PrimaryBtn label={t('matchResult.viewPlan')} onPress={() => viewPlan(existingPlanId)} />
          ) : isStale && capabilities.canRegenerate ? (
            // Finalizing a stale ranking is refused (STALE_SUGGESTIONS), so the
            // host's one way forward is a fresh run, offered as the primary action.
            <PrimaryBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.refreshStale')}
              onPress={onRegenerate}
              loading={regenerate.isPending}
            />
          ) : capabilities.canFinalize && decisionMode !== 'match' ? (
            // Host-only, and server-enforced: a member sending this gets 403.
            <PrimaryBtn
              label={finalize.isPending ? t('matchResult.finalizing') : t('matchResult.finalize')}
              onPress={onFinalize}
              loading={finalize.isPending}
              disabled={isStale || room.data?.status !== 'matching' || (decisionMode === 'vote' && !hasVotes)}
            />
          ) : (
            <Text style={styles.waitingHost}>
              {t(
                isStale
                  ? 'matchResult.staleWaiting'
                  : decisionMode === 'match'
                    ? 'matchResult.waitingMatch'
                    : 'matchResult.waitingHost',
              )}
            </Text>
          )}

          {!existingPlanId && decisionMode !== 'host' ? (
            <SecondaryBtn label={t('matchResult.vote')} disabled={isStale || room.data?.status !== 'matching'}
              onPress={() => router.push(`/room/${roomId}/swipe`)} />
          ) : null}
          {/* Hidden while the refresh is already the primary action above. */}
          {capabilities.canRegenerate && !(isStale && !existingPlanId) ? (
            <SecondaryBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.another')}
              onPress={onRegenerate}
              loading={regenerate.isPending}
            />
          ) : null}

          <GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />
          {finalize.isError && !staleRejected ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(isApiError(finalize.error) ? ({
                NO_VOTES: 'matchResult.noVotes',
                NO_SUGGESTIONS: 'matchResult.emptyBody',
                ROOM_NOT_MATCHING: 'matchResult.roomNotMatching',
              }[finalize.error.code] ?? 'matchResult.finalizeFailed') : 'matchResult.finalizeFailed')}
            </Text>
          ) : null}
          {regenerate.isError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(({
                race: 'matchResult.regenerateRace',
                quorum: 'gogoRoom.quorumRequired',
                failed: 'matchResult.regenerateFailed',
              } as const)[regenerateFailure(regenerate.error)])}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
