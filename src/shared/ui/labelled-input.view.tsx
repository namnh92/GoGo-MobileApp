import type { ReactNode, Ref } from 'react'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, ScrollView, type TextInputProps, View, type LayoutChangeEvent } from 'react-native'
import { TextInput, type TextInputRef } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './labelled-input.style'

/** Drawn S56 state; existing semantic error/disabled/focus tokens for undrawn states. */
export function LabelledInput({ label, icon, trailing, accessory, error, announceError = true, children, ref, groupRef, controlRef, groupTestID, onGroupLayout, helperMaxHeight, ...input }: TextInputProps & {
  label: string; icon: MaterialIconName; trailing?: ReactNode; accessory?: ReactNode
  /** False when a form already announces its server errors as a batch. */
  announceError?: boolean
  error?: string; children?: ReactNode; ref?: Ref<TextInputRef>
  groupRef?: Ref<View>; controlRef?: Ref<View>; groupTestID?: string
  onGroupLayout?: (event: LayoutChangeEvent) => void; helperMaxHeight?: number
}) {
  const { theme } = useUnistyles()
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (error && announceError) AccessibilityInfo.announceForAccessibility(error)
  }, [error, announceError])
  const helpers = <>{children}{error && <Text variant="introCaption" color="status.dangerText" accessibilityLiveRegion="polite">{error}</Text>}</>
  return <View ref={groupRef} testID={groupTestID} onLayout={onGroupLayout} style={styles.field}>
    <View ref={controlRef} style={styles.field}>
      <View style={styles.labelRow}><Text variant="introLabel" color="text.primary">{label}</Text>{accessory}</View>
      <View style={[styles.shell, focused && styles.focus, !!error && styles.invalid, input.editable === false && styles.disabled]}>
        <View style={styles.row}>
          <MaterialIcon name={icon} size={20} color="border.outline" />
          <TextInput {...input} allowFontScaling={false} ref={ref} accessibilityLabel={input.accessibilityLabel ?? label}
            accessibilityHint={error ? [input.accessibilityHint, error].filter(Boolean).join('. ') : input.accessibilityHint}
            aria-invalid={error ? true : undefined}
            multiline={false} placeholderTextColor={theme.border.outline} style={styles.input}
            onFocus={event => { setFocused(true); input.onFocus?.(event) }}
            onBlur={event => { setFocused(false); input.onBlur?.(event) }} />
          {trailing}
        </View>
      </View>
    </View>
    {helperMaxHeight === undefined ? helpers : <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: helperMaxHeight }}>{helpers}</ScrollView>}
  </View>
}
