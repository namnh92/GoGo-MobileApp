import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Atmosphere, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

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
      <View style={styles.hero}>
        <View style={styles.ring}>
          <View style={[styles.core, styles.coreAccent]}>
            <Icon name="compass" size={36} color="accent.primary" />
          </View>
        </View>
        <Text variant="title1" accessibilityRole="header" style={styles.title}>
          {t('notFound.title')}
        </Text>
        <Text color="text.secondary" style={styles.body}>{t('notFound.body')}</Text>
        <View style={styles.cardActions}>
          <PrimaryBtn label={t('shareLink.goHome')} onPress={() => router.replace('/(tabs)')} icon="home" />
        </View>
      </View>
    </Atmosphere>
  )
}
