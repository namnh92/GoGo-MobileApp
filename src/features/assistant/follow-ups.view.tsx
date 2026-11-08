import { Chip } from '@/shared/ui/chip.view'
import { View } from 'react-native'

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
          <Chip key={`${item.label}-${item.text}`} label={item.label}
            accessibilityLabel={label ? `${label} ${item.label}` : item.label}
            variant={disabled ? 'disabled' : item.accent ? 'info' : 'default'}
            onPress={() => onSelect(item.text)} />
        ))}
      </View>
    </View>
  )
}
