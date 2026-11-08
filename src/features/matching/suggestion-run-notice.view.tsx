import { Chip } from '@/shared/ui/chip.view'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useGenerateSuggestions, useRoom } from '@/shared/api'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { formatMoney } from '@/shared/pricing/money'
import { Icon } from '@/shared/ui/icons'
import { GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { regenerateFailure } from './run-state'
import { styles } from './suggestion-run-notice.style'

/**
 * A run that went stale, or finished with nothing to choose from (#199). The
 * recovery is the one the product already has: the host edits the room's
 * conditions (allowed while matching) or refreshes the run; everyone else waits
 * for the host. Host-only actions are server-enforced too.
 */
export function SuggestionRunNotice({
  roomId,
  state,
  isHost,
  onRegenerated,
}: {
  roomId: string
  state: 'stale' | 'empty'
  isHost: boolean
  onRegenerated?: () => void
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const regenerate = useGenerateSuggestions(roomId)
  // The conditions that found nothing, read from the room itself: a fact is
  // shown only when the room has it.
  const room = useRoom(roomId).data
  const radiusM = room?.constraints?.radiusM
  const budget = room?.constraints?.budgetAmount
  const constraintChips = state === 'empty'
    ? [
        radiusM
          ? { key: 'radius', icon: 'navigation' as const, label: t('suggestionRun.constraintRadius', { km: radiusM / 1000 }) }
          : null,
        budget
          ? {
              key: 'budget',
              icon: 'dollar' as const,
              label: t('suggestionRun.constraintBudget', {
                amount: formatMoney(budget, room?.constraints?.currency ?? 'VND'),
                unit: budgetUnitLabel(room?.constraints?.budgetMode, room?.type ?? 'group', t),
              }),
            }
          : null,
      ].filter(item => item !== null)
    : []

  const body =
    state === 'empty'
      ? t(isHost ? 'suggestionRun.emptyBodyHost' : 'suggestionRun.emptyBodyMember')
      : t(isHost ? 'matchResult.staleCause' : 'matchResult.staleWaiting')

  const adjust = isHost && state === 'empty'

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.halo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.tile}>
            <Icon name="compass" size={48} color="accent.primary" />
          </View>
          <View style={styles.badge}>
            <Icon name="search" size={20} color="accent.primary" />
          </View>
        </View>
        <Text variant="title1" accessibilityRole="header" style={styles.title}>
          {t(state === 'empty' ? 'suggestionRun.emptyTitle' : 'suggestionRun.staleTitle')}
        </Text>
        <Text color="text.secondary" style={styles.body}>{body}</Text>
        {constraintChips.length > 0 ? (
          <View style={styles.constraintRow}>
            {constraintChips.map(chip => (
              <Chip key={chip.key} label={chip.label} icon={chip.icon} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {adjust ? (
          <PrimaryBtn
            label={t('suggestionRun.adjustConstraints')}
            onPress={() => router.push(`/room/${roomId}/manage`)}
          />
        ) : null}
        {isHost ? (
          adjust ? (
            <SecondaryBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.refreshStale')}
              onPress={() => regenerate.mutate(undefined, { onSuccess: () => onRegenerated?.() })}
              loading={regenerate.isPending}
            />
          ) : (
            <PrimaryBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.refreshStale')}
              onPress={() => regenerate.mutate(undefined, { onSuccess: () => onRegenerated?.() })}
              loading={regenerate.isPending}
            />
          )
        ) : null}
        {isHost && regenerate.isError ? (
          <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
            {t(({
              race: 'matchResult.regenerateRace',
              quorum: 'gogoRoom.quorumRequired',
              failed: 'matchResult.regenerateFailed',
            } as const)[regenerateFailure(regenerate.error)])}
          </Text>
        ) : null}
        <GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />
      </View>
    </View>
  )
}
