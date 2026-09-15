import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { isApiError, useGenerateSuggestions } from '@/shared/api'
import { EmptyState } from '@/shared/ui/async-state.view'
import { GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'

import { styles } from './run-empty-state.style'

/** The host's refresh can itself be refused; say why instead of a blind retry. */
export function regenerateErrorKey(
  error: unknown,
): 'matchResult.regenerateRace' | 'gogoRoom.quorumRequired' | 'matchResult.regenerateFailed' {
  if (isApiError(error) && error.code === 'STALE_SUGGESTIONS') return 'matchResult.regenerateRace'
  if (isApiError(error) && error.code === 'MATCHING_QUORUM_REQUIRED') return 'gogoRoom.quorumRequired'
  return 'matchResult.regenerateFailed'
}

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

  return (
    <EmptyState
      title={t(state === 'empty' ? 'suggestionRun.emptyTitle' : 'suggestionRun.staleTitle')}
      body={body}
      action={
        <View style={styles.actions}>
          {isHost ? (
            <SecondaryBtn
              label={regenerate.isPending ? t('matchResult.regenerating') : t('matchResult.refreshStale')}
              onPress={() => regenerate.mutate(undefined, { onSuccess: () => onRegenerated?.() })}
              loading={regenerate.isPending}
            />
          ) : null}
          {isHost && state === 'empty' ? (
            <GhostBtn
              label={t('suggestionRun.adjustConstraints')}
              onPress={() => router.push(`/room/${roomId}/manage`)}
            />
          ) : null}
          {isHost && regenerate.isError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(regenerateErrorKey(regenerate.error))}
            </Text>
          ) : null}
          <GhostBtn label={t('swipe.goToLobby')} onPress={() => router.replace(`/room/${roomId}`)} />
        </View>
      }
    />
  )
}
