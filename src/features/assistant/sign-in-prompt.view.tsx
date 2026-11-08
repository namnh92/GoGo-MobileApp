import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { PrimaryBtn } from '@/shared/ui/button.view'

import { AssistantAvatar } from './assistant-avatar.view'
import { styles } from './sign-in-prompt.style'

/**
 * Guests and signed-out people see the entry but cannot use GoGo AI (owner
 * decision on #377, 2026-10-26; the API answers `403 USER_ONLY`). They get
 * this instead of a composer: why, and the way to sign in. The padlock on the
 * avatar says "locked" in shape, beside the words.
 */
export function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation()
  return (
    <ScrollView testID="assistant-sign-in" contentContainerStyle={styles.body}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <AssistantAvatar size="lg" />
          <View style={styles.lock}>
            <Icon name="lock" size={16} color="accent.onAccent" />
          </View>
        </View>
        <Text variant="title1" accessibilityRole="header" style={styles.centered}>{t('assistant.signIn.title')}</Text>
        <Text variant="body" color="text.secondary" style={styles.centered}>{t('assistant.signIn.body')}</Text>
        <View style={styles.benefits}>
          {(['history', 'sources', 'confirmation'] as const).map(key => (
            <View key={key} style={styles.benefit}>
              <Icon name="checkCircle" size={24} color="status.successText" />
              <Text variant="bodySmall" style={styles.benefitText}>{t(`assistant.signIn.benefit.${key}`)}</Text>
            </View>
          ))}
        </View>
        <PrimaryBtn size="regular" variant="pill" label={t('assistant.signIn.cta')} trailingIcon="arrowRight" onPress={onSignIn} style={styles.cta} />
      </View>
      <View testID="assistant-locked-composer" style={styles.lockedDock}>
        <View style={styles.benefit}>
          <Text variant="caption" color="text.secondary" style={styles.benefitText}>{t('assistant.composer.label')}</Text>
          <Icon name="lock" size={16} color="text.secondary" />
        </View>
        <View style={styles.lockedField}>
          <Text variant="body" color="text.secondary" style={styles.benefitText}>{t('assistant.signIn.lockedHint')}</Text>
          <Icon name="send" size={20} color="text.secondary" />
        </View>
      </View>
    </ScrollView>
  )
}
