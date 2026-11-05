import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { styles } from './invite-expired.style'

/** An invite answered 410 and a new link would help: two ways on, no dead form. */
export function InviteExpired() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <View testID="invite-expired" style={styles.container}>
      <Text variant="display" accessibilityRole="header" style={styles.title}>{t('guestJoin.expiredTitle')}</Text>
      <Text color="text.secondary" accessibilityLiveRegion="polite" style={styles.body}>{t('guestJoin.expiredBody')}</Text>
      <PrimaryBtn label={t('guestJoin.expiredHome')} onPress={() => router.replace('/')} icon="home" />
      <SecondaryBtn label={t('joinByCode.title')} onPress={() => router.replace('/join')} icon="unlock" />
    </View>
  )
}
