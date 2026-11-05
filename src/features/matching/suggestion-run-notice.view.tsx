import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useGenerateSuggestions } from '@/shared/api'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Card, Chip, GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { regenerateFailure } from './run-state'
import { styles } from './suggestion-run-notice.style'

const RELAX_ROWS: { key: 'radius' | 'budget' | 'time'; icon: IconName }[] = [
  { key: 'radius', icon: 'compass' },
  { key: 'budget', icon: 'dollar' },
  { key: 'time', icon: 'clock' },
]

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
        {adjust ? (
          // TODO(#452): rows stay unavailable until the API suggests a relaxation;
          // today's way forward is the primary action below (core rule 16).
          <Card padded={false} style={styles.relaxCard}>
            <Text variant="label">{t('suggestionRun.relaxTitle')}</Text>
            {RELAX_ROWS.map(row => (
              <View key={row.key} style={styles.relaxRow}>
                <Icon name={row.icon} size={18} color="text.secondary" />
                <Text variant="bodySmall" color="text.secondary" style={styles.relaxLabel}>{t(`suggestionRun.relax.${row.key}`)}</Text>
                <Chip label={t('planChange.soon')} variant="disabled" />
              </View>
            ))}
          </Card>
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
