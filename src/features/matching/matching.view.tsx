import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useRoom } from '@/shared/store/roomStore'
import { AvatarCircle } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './matching.style'

export default function MatchingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const content = useLocaleContent()
  const { roomType } = useRoom()
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200)
    const t2 = setTimeout(() => {
      setPhase(2)
      track('match_generated')
    }, 2400)
    const t3 = setTimeout(() => router.replace(`/room/${roomId}/match-result`), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [router, roomId])

  return (
    <View style={styles.root}>
      <View style={styles.pair}>
        <AvatarCircle label="M" size={64} background={colors.brand.coral} />
        <Text style={styles.times}>×</Text>
        <AvatarCircle emoji="😊" size={64} />
      </View>

      {phase < 2 ? (
        <View style={{ alignItems: 'center', gap: spacing[3] }}>
          <Text style={styles.message}>{content.matchingMessages[phase]}</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 64, marginBottom: spacing[2] }}>🎉</Text>
          <Text style={styles.matched}>{t('matching.matched')}</Text>
          <Text style={styles.matchedBody}>{t('matching.matchedBody', { context: roomType })}</Text>
        </View>
      )}
    </View>
  )
}
