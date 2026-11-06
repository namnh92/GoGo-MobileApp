import type { ReactNode, Ref } from 'react'
import { useState } from 'react'
import { TextInput, type TextInputProps, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './labelled-input.style'

/** Drawn S56 state; existing semantic error/disabled/focus tokens for undrawn states. */
export function LabelledInput({ label, icon, trailing, accessory, error, children, ref, ...input }: TextInputProps & {
  label: string; icon: MaterialIconName; trailing?: ReactNode; accessory?: ReactNode
  error?: string; children?: ReactNode; ref?: Ref<TextInput>
}) {
  const { theme } = useUnistyles()
  const [focused, setFocused] = useState(false)
  return <View style={styles.field}>
    <View style={styles.labelRow}><Text variant="introLabel" color="redesign.ink">{label}</Text>{accessory}</View>
    <View style={[styles.shell, focused && styles.focus, !!error && styles.invalid, input.editable === false && styles.disabled]}>
      <View style={styles.row}>
        <MaterialIcon name={icon} size={20} color="redesign.outline" />
        <TextInput {...input} ref={ref} accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={theme.redesign.outline} style={styles.input}
          onFocus={event => { setFocused(true); input.onFocus?.(event) }}
          onBlur={event => { setFocused(false); input.onBlur?.(event) }} />
        {trailing}
      </View>
    </View>
    {children}
    {error && <Text variant="introCaption" color="status.dangerText">{error}</Text>}
  </View>
}
