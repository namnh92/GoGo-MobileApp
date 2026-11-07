import { Pressable, View } from 'react-native'
import { Text } from './text'
import { styles } from './filled-segmented-control.style'

export function FilledSegmentedControl<Value extends string>({ options, value, onChange }: {
  options: readonly { value: Value; label: string }[]
  value: Value
  onChange: (value: Value) => void
}) {
  return <View testID="filled-segmented-control" style={styles.tabs} accessibilityRole="tablist">
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)}
      style={[styles.tab, value === option.value && styles.tabSelected]}>
      <Text variant={value === option.value ? 'label' : 'bodySmall'} color={value === option.value ? 'accent.onAccent' : 'text.primary'}>{option.label}</Text>
    </Pressable>)}
  </View>
}
