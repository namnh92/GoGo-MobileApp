import { Pressable, View } from 'react-native'
import { Text } from './text'
import { styles } from './segmented-tabs.style'

export function SegmentedTabs<Value extends string>({ options, value, onChange }: {
  options: readonly { value: Value; label: string; count?: number | string }[]
  value: Value
  onChange: (value: Value) => void
}) {
  return <View testID="segmented-tabs" style={styles.tabs} accessibilityRole="tablist">
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)}
      style={[styles.tab, value === option.value && styles.tabSelected]}>
      <Text variant={value === option.value ? 'label' : 'bodySmall'} color={value === option.value ? 'accent.onAccent' : 'text.secondary'}>{option.count == null ? option.label : `${option.label} (${option.count})`}</Text>
    </Pressable>)}
  </View>
}
