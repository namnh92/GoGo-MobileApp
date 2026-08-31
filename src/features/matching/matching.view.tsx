import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import {
  isApiError,
  roomCapabilities,
  useCurrentSuggestions,
  useRoom,
  useRoomRealtime,
  useStartMatching,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { AvatarCircle } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './matching.style'

/** Rotates the reassurance copy while the pipeline runs. */
const MESSAGE_INTERVAL_MS = 1400

export default function MatchingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const content = useLocaleContent()

  const room = useRoom(roomId)
  const suggestions = useCurrentSuggestions(roomId)
  useRoomRealtime(roomId, 'matching')
  const startMatching = useStartMatching(roomId)

  const [messageIndex, setMessageIndex] = useState(0)
  const roomType = room.data?.type ?? 'couple'
  const capabilities = roomCapabilities(room.data)

  const hasRun = Boolean(suggestions.data?.run)
  const isStale = suggestions.data?.run?.stale ?? false

  // The copy cycles on a timer; the *navigation* does not — it waits for a real
  // run to exist, so this screen can never promise a result that is not there.
  useEffect(() => {
    const timer = setInterval(
      () => setMessageIndex(index => (index + 1) % Math.max(content.matchingMessages.length, 1)),
      MESSAGE_INTERVAL_MS,
    )
    return () => clearInterval(timer)
  }, [content.matchingMessages.length])

  // Only the host may run the pipeline; a member waits for the host's run to
  // land. Guarded so a re-render cannot fire a second generate.
  const requested = useRef(false)
  useEffect(() => {
    if (!capabilities.isHost || requested.current) return
    if (suggestions.isPending || (hasRun && !isStale)) return
    requested.current = true
    startMatching.mutate(undefined, {
      onSuccess: () => track('match_generated'),
    })
  }, [capabilities.isHost, suggestions.isPending, hasRun, isStale, startMatching])

  useEffect(() => {
    if (!hasRun || isStale) return
    const timer = setTimeout(() => router.replace(`/room/${roomId}/match-result`), 800)
    return () => clearTimeout(timer)
  }, [hasRun, isStale, roomId, router])

  const failed = startMatching.isError
  const notReady = isApiError(startMatching.error) && startMatching.error.status === 409

  return (
    <View style={styles.root}>
      <View style={styles.pair}>
        <AvatarCircle label="G" size={64} background={colors.brand.coral} />
        <Text style={styles.times}>×</Text>
        <AvatarCircle emoji="😊" size={64} />
      </View>

      {failed ? (
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <Text style={styles.matched}>{t('matching.failedTitle')}</Text>
          <Text style={styles.matchedBody}>
            {notReady ? t('matching.notReadyBody') : t('common.errorBody')}
          </Text>
          <Pressable onPress={() => router.replace(`/room/${roomId}`)} accessibilityRole="button">
            <Text style={styles.backLink}>{t('swipe.goToLobby')}</Text>
          </Pressable>
        </View>
      ) : hasRun && !isStale ? (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 64, marginBottom: spacing[2] }}>🎉</Text>
          <Text style={styles.matched}>{t('matching.matched')}</Text>
          <Text style={styles.matchedBody}>{t('matching.matchedBody', { context: roomType })}</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <Text style={styles.message}>{content.matchingMessages[messageIndex]}</Text>
          {/* A member cannot start the run; say so instead of spinning forever. */}
          {!capabilities.isHost ? (
            <Text style={styles.matchedBody}>{t('matching.waitingForHost')}</Text>
          ) : null}
        </View>
      )}
    </View>
  )
}
