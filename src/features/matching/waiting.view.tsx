import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { groupMembers } from '@/data/mockData'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, GlassCard, glassStyles } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './waiting.style'

const { neutral } = colors

const PARTNER_GOAL = 12
const REMIND_COOLDOWN_MS = 5 * 60 * 1000

export default function WaitingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const { roomType } = useRoom()
  const [progress, setProgress] = useState(7)
  const [reminded, setReminded] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setProgress(p => Math.min(p + 1, PARTNER_GOAL)), 600)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (progress < PARTNER_GOAL) return
    const timer = setTimeout(() => router.replace(`/room/${roomId}/matching`), 800)
    return () => clearTimeout(timer)
  }, [progress, router, roomId])

  useEffect(() => {
    if (!reminded) return
    const timer = setTimeout(() => setReminded(false), REMIND_COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [reminded])

  const others =
    roomType === 'group'
      ? [
          ...groupMembers.map((m, i) => ({ ...m, progress: Math.min(m.progress + (progress - 7), m.goal), key: `${m.name}-${i}` })),
          { name: 'Trang', emoji: '🧑‍🎤', progress: 0, goal: PARTNER_GOAL, key: 'not-started' },
        ]
      : [{ name: t('waiting.partner'), emoji: '😊', progress, goal: PARTNER_GOAL, key: 'partner' }]
  const pendingCount = others.filter(m => m.progress < m.goal).length

  return (
    <Atmosphere style={styles.root}>
      <Text style={styles.eyes}>👀</Text>
      <Text style={styles.title}>{t('waiting.title')}</Text>
      <Text style={styles.body}>{t('waiting.body', { context: roomType })}</Text>

      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <AvatarCircle label="M" size={32} />
            <Text style={styles.name}>{t('waiting.you')}</Text>
          </View>
          <View style={styles.doneRow}>
            <IconCheck />
            <Text style={styles.doneLabel}>{t('waiting.done')}</Text>
          </View>
        </View>
        {others.map(m => (
          <View key={m.key} style={styles.row}>
            <View style={styles.rowLeft}>
              <AvatarCircle emoji={m.emoji} size={32} />
              <Text style={styles.name}>{m.name}</Text>
            </View>
            {m.progress === 0 ? (
              <Text style={styles.notStarted}>{t('waiting.notStarted')}</Text>
            ) : m.progress >= m.goal ? (
              <Text style={styles.doneLabel}>{t('waiting.done')}</Text>
            ) : (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(m.progress / m.goal) * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{m.progress} / {m.goal}</Text>
              </View>
            )}
          </View>
        ))}
      </GlassCard>

      <Pressable
        onPress={() => setReminded(true)}
        disabled={reminded}
        style={[styles.remindBtn, glassStyles.card]}
      >
        <Text style={[styles.remindLabel, reminded && { color: neutral[300] }]}>
          {reminded ? t('waiting.reminded') : t('waiting.remind', { context: roomType })}
        </Text>
      </Pressable>

      {roomType === 'group' && (
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
