import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { hitSlop } from '@/shared/ui/tokens'

import { styles } from './context-chip.style'

/**
 * What GoGo AI was opened about ("About Nhà Lá Café"), removable
 * (GoGo-MobileApp#379). Without it the assistant sees no screen data. The ×
 * draws at 28pt and reaches 44pt through its hit slop.
 */
export function ContextChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation()
  return (
    <View testID="assistant-context-chip" style={styles.chip}>
      <Icon name="mapPin" size={14} />
      <Text variant="label" numberOfLines={1} style={styles.label}>
        <Text variant="label" color="text.secondary">{t('assistant.context.about')} </Text>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('assistant.context.remove', { name: label })}
        hitSlop={hitSlop}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
      >
        <Icon name="x" size={14} color="text.secondary" />
      </Pressable>
    </View>
  )
}
