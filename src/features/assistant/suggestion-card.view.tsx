import { Pressable, View } from 'react-native'

import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './suggestion-card.style'

/**
 * Design system `SuggestionCard`: a starting point on Welcome — an accent-soft
 * icon tile, a title of up to three words and one line. Tapping sends the
 * title as the first message.
 */
export function SuggestionCard({
  icon,
  title,
  description,
  onPress,
  disabled = false,
}: {
  icon: IconName
  title: string
  description: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.tile}>
        <Icon name={icon} size={20} color="accent.onSoft" />
      </View>
      <Text variant="title2" numberOfLines={2}>{title}</Text>
      <Text variant="bodySmall" color="text.secondary" numberOfLines={2}>{description}</Text>
    </Pressable>
  )
}
