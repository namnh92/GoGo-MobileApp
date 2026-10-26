import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Text } from '@/shared/ui/text'
import { PrimaryBtn } from '@/shared/ui/button.view'

import { AssistantAvatar } from './assistant-avatar.view'
import { styles } from './sign-in-prompt.style'

/**
 * Guests and signed-out people see the entry but cannot use GoGo AI (owner
 * decision on #377, 2026-10-26; the API answers `403 USER_ONLY`). They get
 * this instead of a composer: why, and the way to sign in.
 */
export function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation()
  return (
    <View testID="assistant-sign-in" style={styles.body}>
      <AssistantAvatar size="lg" />
      <Text variant="title1" accessibilityRole="header" style={styles.centered}>{t('assistant.signIn.title')}</Text>
      <Text variant="body" color="text.secondary" style={styles.centered}>{t('assistant.signIn.body')}</Text>
      <PrimaryBtn label={t('assistant.signIn.cta')} onPress={onSignIn} style={styles.cta} />
    </View>
  )
}
