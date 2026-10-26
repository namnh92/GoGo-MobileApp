import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './user-message.style'

/**
 * Design system `UserMessage`: the person's turn, a right-aligned accent
 * bubble — never confused with the assistant's unboxed replies. A message the
 * server never accepted turns `surface.subtle` with "Not sent. Tap to retry":
 * shape, colour and words all change, so colour is not the only signal.
 */
export function UserMessage({
  text,
  time,
  photos = 0,
  state = 'sent',
  onRetry,
}: {
  text: string
  time?: string
  photos?: number
  state?: 'sent' | 'sending' | 'failed'
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const failed = state === 'failed'
  const bubble = (
    <View style={[styles.bubble, failed && styles.bubbleFailed]}>
      {photos > 0 ? (
        <View style={styles.photos}>
          <Icon name="attach" size={14} color={failed ? 'text.primary' : 'accent.onAccent'} />
          <Text variant="caption" color={failed ? 'text.primary' : 'accent.onAccent'}>
            {t('assistant.message.photos', { count: photos })}
          </Text>
        </View>
      ) : null}
      <Text variant="body" color={failed ? 'text.primary' : 'accent.onAccent'}>{text}</Text>
    </View>
  )
  return (
    <View style={styles.row}>
      {failed && onRetry ? (
        <Pressable
          testID="assistant-user-retry"
          accessibilityRole="button"
          accessibilityLabel={`${t('assistant.message.you', { text })}. ${t('assistant.message.notSent')}`}
          onPress={onRetry}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
        >
          {bubble}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={t('assistant.message.you', { text })}>{bubble}</View>
      )}
      {failed ? (
        <View style={styles.meta}>
          <Icon name="alert" size={12} color="status.dangerText" />
          <Text variant="caption" color="status.dangerText">
            {onRetry ? t('assistant.message.notSent') : t('assistant.message.notSentLabel')}
          </Text>
        </View>
      ) : state === 'sending' ? (
        <Text variant="caption" color="text.secondary" style={styles.metaText}>{t('assistant.message.sending')}</Text>
      ) : time ? (
        <Text variant="caption" color="text.secondary" style={styles.metaText}>{time}</Text>
      ) : null}
    </View>
  )
}
