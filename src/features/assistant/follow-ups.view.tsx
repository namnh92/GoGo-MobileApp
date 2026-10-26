import { Pressable, View } from 'react-native'

import { Text } from '@/shared/ui/text'

import { styles } from './follow-ups.style'

export interface FollowUpItem {
  label: string
  /** Sent as the next message when tapped. */
  text: string
  accent?: boolean
}

/**
 * Design system `FollowUps`: quick answers or next questions as chips under
 * the latest reply. With a `label` the chips answer it ("How many people?").
 * Each chip sends its text as the person's next message.
 */
export function FollowUps({
  label,
  items,
  onSelect,
  disabled = false,
}: {
  label?: string
  items: FollowUpItem[]
  onSelect: (text: string) => void
  disabled?: boolean
}) {
  return (
    <View style={styles.group}>
      {label ? <Text variant="label" color="text.secondary">{label}</Text> : null}
      <View style={styles.chips}>
        {items.map(item => (
          <Pressable
            key={`${item.label}-${item.text}`}
            accessibilityRole="button"
            accessibilityLabel={label ? `${label} ${item.label}` : item.label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onSelect(item.text)}
            style={({ pressed }) => [
              styles.chip,
              item.accent && styles.chipAccent,
              pressed && (item.accent ? styles.chipAccentPressed : styles.chipPressed),
              disabled && styles.chipDisabled,
            ]}
          >
            <Text variant="label" color={disabled ? 'text.secondary' : item.accent ? 'accent.onSoft' : 'text.primary'}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
