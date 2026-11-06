import { Pressable, View } from 'react-native'
import { Text } from './text'
import { styles } from './segmented-control.style'

export function SegmentedControl<Value extends string>({ options, value, onChange, disabled = false }: {
  options: readonly { value: Value; label: string }[]; value: Value; onChange: (value: Value) => void; disabled?: boolean
}) {
  return <View style={styles.track}>{options.map(option => <Pressable key={option.value}
    onPress={() => onChange(option.value)} disabled={disabled} accessibilityRole="tab" hitSlop={{ top: 5, bottom: 5 }}
    accessibilityState={{ selected: option.value === value, disabled }}
    style={({ pressed }) => [styles.tab, option.value === value && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text variant={option.value === value ? 'introLabel' : 'introSmall'} color={option.value === value ? 'redesign.ink' : 'redesign.secondary'}>{option.label}</Text>
  </Pressable>)}</View>
}
