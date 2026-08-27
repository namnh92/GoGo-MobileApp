import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { roomCapabilities, useRoom, useRoomMembers, useRoomRealtime } from '@/shared/api'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, AvatarCircle, GlassCard, glassStyles } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './waiting.style'

const { neutral } = colors

const REMIND_COOLDOWN_MS = 5 * 60 * 1000

export default function WaitingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const members = useRoomMembers(roomId)
  // Other members finish picking while this screen sits open.
  useRoomRealtime(roomId, 'lobby')

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
        <LoadingState />
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

  return (
    <Atmosphere style={styles.root}>
      <Text style={styles.eyes}>👀</Text>
      <Text style={styles.title}>{t('waiting.title')}</Text>
      <Text style={styles.body}>{t('waiting.body', { context: roomType })}</Text>

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
              <Text style={styles.doneLabel}>{t('waiting.done')}</Text>
            ) : member.selectionStatus === 'in_progress' ? (
              <Text style={styles.progressLabel}>{t('waiting.inProgress')}</Text>
            ) : (
              <Text style={styles.notStarted}>{t('waiting.notStarted')}</Text>
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

      <Pressable onPress={() => setReminded(true)} disabled={reminded} style={[styles.remindBtn, glassStyles.card]}>
        <Text style={[styles.remindLabel, reminded && { color: neutral[300] }]}>
          {reminded ? t('waiting.reminded') : t('waiting.remind', { context: roomType })}
        </Text>
      </Pressable>

      {/* Only the host can start matching early (server-enforced). */}
      {roomType === 'group' && capabilities.isHost && (
        <View style={{ marginTop: spacing[3], alignItems: 'center', gap: 6 }}>
          <Pressable onPress={() => router.replace(`/room/${roomId}/matching`)} style={styles.partialBtn}>
            <Text style={styles.partialLabel}>{t('waiting.viewPartial')}</Text>
          </Pressable>
          {pendingCount > 0 && (
            <Text style={styles.partialWarning}>⚠️ {t('waiting.partialWarning', { n: pendingCount })}</Text>
          )}
        </View>
      )}
    </Atmosphere>
  )
}
