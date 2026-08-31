import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { isOffline, roomCapabilities, useRoom, useRoomMembers, useRoomRealtime } from '@/shared/api'
import { ErrorState } from '@/shared/ui/async-state.view'
import { Atmosphere, AvatarCircle, Chip, GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { IconCheck } from '@/shared/ui/icons'

import { styles } from './waiting.style'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'

const REMIND_COOLDOWN_MS = 5 * 60 * 1000

export default function WaitingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const members = useRoomMembers(roomId)
  // Other members finish picking while this screen sits open.
  useRoomRealtime(roomId, 'lobby', { enabled: useScreenFocused() })

  const [reminded, setReminded] = useState(false)

  useEffect(() => {
    if (!reminded) return
    const timer = setTimeout(() => setReminded(false), REMIND_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [reminded])

  const summary = room.data
  const roomType = summary?.type ?? 'group'
  const capabilities = roomCapabilities(summary)

  // The room flips to `matching` server-side once everyone has completed, so
  // that transition — not a timer — is what moves this screen along.
  useEffect(() => {
    if (summary?.status === 'matching' || summary?.status === 'ready') {
      router.replace(`/room/${roomId}/matching`)
    }
  }, [summary?.status, roomId, router])

  if (room.isPending || members.isPending) {
    return (
      <Atmosphere style={styles.root}>
        <View style={{ alignSelf: 'stretch' }}>
          <RoomMemberSkeleton count={3} />
        </View>
      </Atmosphere>
    )
  }

  if (room.isError || members.isError) {
    return (
      <Atmosphere style={styles.root}>
        <ErrorState
          error={room.error ?? members.error}
          onRetry={() => {
            void room.refetch()
            void members.refetch()
          }}
        />
      </Atmosphere>
    )
  }

  const myMemberId = summary?.myMemberId
  const roster = members.data ?? []
  const others = roster.filter(member => member.id !== myMemberId)
  const pendingCount = others.filter(member => member.selectionStatus !== 'completed').length

  // Progress is the answer to "how much longer" — the reason this screen
  // exists. It comes from the roster's statuses, never a local guess.
  const completedCount = roster.filter(member => member.selectionStatus === 'completed').length
  const totalExpected = summary?.participantCount ?? roster.length
  const progressPct = totalExpected > 0 ? Math.round((completedCount / totalExpected) * 100) : 0

  // A dropped realtime connection leaves this screen silently stale; the
  // refetch is what unsticks it, so say so rather than waiting forever.
  const staleError = room.isError || members.isError ? (room.error ?? members.error) : null

  return (
    <Atmosphere style={styles.root}>
      <Text style={styles.eyes}>👀</Text>
      <Text style={styles.title}>{t('waiting.title')}</Text>
      <Text style={styles.body}>{t('waiting.body', { context: roomType })}</Text>

      <View style={styles.progress}>
        <Text style={styles.progressLabel} accessibilityLiveRegion="polite">
          {t('waiting.progress', { done: completedCount, total: totalExpected })}
        </Text>
        <View
          style={styles.progressTrack}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {staleError ? (
        <Text accessibilityLiveRegion="polite" style={styles.retryNote}>
          {isOffline(staleError) ? t('common.staleOffline') : t('common.staleError')}
        </Text>
      ) : null}

      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <AvatarCircle label={(roster.find(m => m.id === myMemberId)?.displayName ?? '?').charAt(0).toUpperCase()} size={32} />
            <Text style={styles.name}>{t('waiting.you')}</Text>
          </View>
          <View style={styles.doneRow}>
            <IconCheck />
            <Text style={styles.doneLabel}>{t('waiting.done')}</Text>
          </View>
        </View>

        {others.map(member => (
          <View key={member.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <AvatarCircle label={member.displayName.charAt(0).toUpperCase()} size={32} />
              <Text style={styles.name}>{member.displayName}</Text>
            </View>
            {/* The contract reports a status, not a count, so the UI shows the
                status rather than inventing a progress fraction. */}
            {member.selectionStatus === 'completed' ? (
              <Chip label={t('waiting.done')} variant="positive" />
            ) : member.selectionStatus === 'in_progress' ? (
              <Chip label={t('waiting.inProgress')} variant="info" />
            ) : (
              <Chip label={t('waiting.notStarted')} variant="default" />
            )}
          </View>
        ))}

        {/* Someone invited but not yet joined has no member row at all. */}
        {summary && roster.length < summary.participantCount ? (
          <Text style={styles.notStarted}>
            {t('waiting.notJoined', { n: summary.participantCount - roster.length })}
          </Text>
        ) : null}
      </GlassCard>

      <View style={styles.actions}>
        {/* Only the host can start matching early (server-enforced). */}
        {roomType === 'group' && capabilities.isHost ? (
          <SecondaryBtn
            label={t('waiting.viewPartial')}
            onPress={() => router.replace(`/room/${roomId}/matching`)}
          />
        ) : null}
        <GhostBtn
          label={reminded ? t('waiting.reminded') : t('waiting.remind', { context: roomType })}
          onPress={() => setReminded(true)}
          disabled={reminded}
        />
        {/* Retrying is the only thing that unsticks a dropped realtime feed. */}
        <GhostBtn
          label={t('common.retry')}
          onPress={() => {
            void room.refetch()
            void members.refetch()
          }}
        />
      </View>
      {roomType === 'group' && capabilities.isHost && pendingCount > 0 ? (
        <Text style={styles.partialWarning}>⚠️ {t('waiting.partialWarning', { n: pendingCount })}</Text>
      ) : null}

    </Atmosphere>
  )
}
