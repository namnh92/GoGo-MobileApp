import { useTranslation } from 'react-i18next'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { Text } from '@/shared/ui/text'

import { styles } from './assistant-coachmark.style'

/**
 * The one-time introduction to GoGo AI on Home (GoGo-MobileApp#379). The rest
 * of the screen dims and takes no touches; "Try it" opens GoGo AI and "Not now"
 * dismisses — either is final. A modal for screen readers too, so focus stays
 * on the two choices.
 */
export function AssistantCoachmark({ onTry, onDismiss, style }: {
  onTry: () => void
  onDismiss: () => void
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useTranslation()
  return (
    <>
      <View testID="assistant-coachmark-dim" style={styles.dim} />
      <View
        testID="assistant-coachmark"
        accessibilityViewIsModal
        accessibilityLabel={t('assistant.coachmark.title')}
        style={[styles.card, style]}
      >
        <View style={styles.arrow} />
        <Text variant="title2" color="text.inverse" accessibilityRole="header">{t('assistant.coachmark.title')}</Text>
        <Text variant="bodySmall" color="onDark.strong">{t('assistant.coachmark.body')}</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [styles.action, pressed && styles.ghostPressed]}
          >
            <Text variant="label" color="text.inverse">{t('assistant.coachmark.dismiss')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onTry}
            style={({ pressed }) => [styles.action, styles.primary, pressed && styles.primaryPressed]}
          >
            <Text variant="label" color="accent.onAccent">{t('assistant.coachmark.try')}</Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}
