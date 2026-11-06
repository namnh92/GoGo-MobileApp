import { Pressable, View } from 'react-native'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './segmented-control.style'

export function SegmentedControl<Value extends string>({ options, value, onChange, disabled = false, compact = false }: {
  options: readonly { value: Value; label: string; icon?: MaterialIconName }[]; value: Value; onChange: (value: Value) => void; disabled?: boolean; compact?: boolean
}) {
  return <View style={styles.track}><View testID="segmented-rail" pointerEvents="none" style={styles.rail} />{options.map(option => <Pressable key={option.value}
    onPress={() => onChange(option.value)} disabled={disabled} accessibilityRole="tab"
    accessibilityState={{ selected: option.value === value, disabled }}
    style={[styles.tab, disabled && styles.disabled]}>
    {({ pressed }) => <View style={[styles.surface, compact && styles.compact, option.value === value && styles.selected, pressed && styles.pressed]}>
    {option.icon ? <MaterialIcon name={option.icon} size={16} color="redesign.secondary" /> : null}
    <Text variant={compact ? 'introCaptionMedium' : option.value === value ? 'introLabel' : 'introSmall'} color={option.value === value ? 'redesign.ink' : 'redesign.secondary'}>{option.label}</Text>
    </View>}
  </Pressable>)}</View>
}
