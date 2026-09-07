import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Atmosphere, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'

import { styles } from './share-link.style'

/**
 * Catch-all for a route nothing claims.
 *
 * Without this file expo-router shows its own developer page — English, with the
 * raw URL printed on it — to whoever followed the link. A stale share link, an
 * old push payload, or a typo in a pasted URL are all ordinary things for a
 * person to do, and none of them should end in a debug screen.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <Atmosphere>
      <View style={styles.centre}>
        <GlassCard style={styles.card}>
          <Text style={styles.emoji}>🧭</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {t('notFound.title')}
          </Text>
          <Text style={styles.body}>{t('notFound.body')}</Text>
        </GlassCard>
        <View style={styles.actions}>
          <SecondaryBtn label={t('shareLink.goHome')} onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    </Atmosphere>
  )
}
