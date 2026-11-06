import type { ReactNode, Ref } from 'react'
import { useState } from 'react'
import { ScrollView, TextInput, type TextInputProps, View, type LayoutChangeEvent } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './labelled-input.style'

/** Drawn S56 state; existing semantic error/disabled/focus tokens for undrawn states. */
export function LabelledInput({ label, icon, trailing, accessory, error, children, ref, groupRef, controlRef, groupTestID, onGroupLayout, helperMaxHeight, ...input }: TextInputProps & {
  label: string; icon: MaterialIconName; trailing?: ReactNode; accessory?: ReactNode
  error?: string; children?: ReactNode; ref?: Ref<TextInput>
  groupRef?: Ref<View>; controlRef?: Ref<View>; groupTestID?: string
  onGroupLayout?: (event: LayoutChangeEvent) => void; helperMaxHeight?: number
}) {
  const { theme } = useUnistyles()
  const [focused, setFocused] = useState(false)
  const helpers = <>{children}{error && <Text variant="introCaption" color="status.dangerText">{error}</Text>}</>
  return <View ref={groupRef} testID={groupTestID} onLayout={onGroupLayout} style={styles.field}>
    <View ref={controlRef} style={styles.field}>
      <View style={styles.labelRow}><Text variant="introLabel" color="redesign.ink">{label}</Text>{accessory}</View>
      <View style={[styles.shell, focused && styles.focus, !!error && styles.invalid, input.editable === false && styles.disabled]}>
        <View style={styles.row}>
          <MaterialIcon name={icon} size={20} color="redesign.outline" />
          <TextInput {...input} ref={ref} accessibilityLabel={input.accessibilityLabel ?? label}
            multiline={false} placeholderTextColor={theme.redesign.outline} style={styles.input}
            onFocus={event => { setFocused(true); input.onFocus?.(event) }}
            onBlur={event => { setFocused(false); input.onBlur?.(event) }} />
          {trailing}
        </View>
      </View>
    </View>
    {helperMaxHeight === undefined ? helpers : <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: helperMaxHeight }}>{helpers}</ScrollView>}
  </View>
}
