import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { AssistantAvatar } from './assistant-avatar.view'
import { styles } from './assistant-header.style'

/**
 * The top bar of GoGo AI opened over the app (GoGo-MobileApp#379): Close (×)
 * instead of Back, the avatar, "GoGo AI" and its subtitle. History arrives with
 * the real conversation screens (#378); a button with nowhere to go is not
 * drawn.
 */
export function AssistantHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <View style={styles.header}>
      <Pressable
        testID="assistant-close"
        accessibilityRole="button"
        accessibilityLabel={t('assistant.close')}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        <Icon name="x" size={22} />
      </Pressable>
      <View style={styles.identity}>
        <AssistantAvatar size="md" />
        <View style={styles.text}>
          <Text variant="title2" accessibilityRole="header" numberOfLines={1}>{t('assistant.name')}</Text>
          <Text variant="caption" color="text.secondary" numberOfLines={1}>{t('assistant.subtitle')}</Text>
        </View>
      </View>
    </View>
  )
}
