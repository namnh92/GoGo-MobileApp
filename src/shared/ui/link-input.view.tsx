import { useState, type Ref } from 'react'
import { Pressable, View, type TextInputProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useUnistyles } from 'react-native-unistyles'
import { Icon } from './icons'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { TextInput, type TextInputRef } from './text-input'
import { styles } from './link-input.style'

type LinkInputProps = Omit<TextInputProps, 'style' | 'multiline' | 'numberOfLines' | 'scrollEnabled' | 'placeholderTextColor'> & {
  ref?: Ref<TextInputRef>
  value: string
  onClear: () => void
  error?: boolean
  clearTestID?: string
  displayTestID?: string
}

/** One link surface: truncated at rest, horizontally editable on focus. */
export function LinkInput({ ref, value, onClear, error = false, clearTestID, displayTestID, onFocus, onBlur, editable = true, ...props }: LinkInputProps) {
  const [focused, setFocused] = useState(false)
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return <View style={styles.field}>
    <View pointerEvents="none" style={styles.location}><MaterialIcon name="location" size={20} color="status.successText" /></View>
    <TextInput {...props} ref={ref} value={value} editable={editable}
      multiline={false} numberOfLines={1} scrollEnabled
      autoCapitalize="none" autoCorrect={false} keyboardType="url"
      placeholderTextColor={theme.border.outline}
      onFocus={event => { setFocused(true); onFocus?.(event) }}
      onBlur={event => { setFocused(false); onBlur?.(event) }}
      style={[styles.input, !focused && !!value && styles.unfocused, error && styles.error]} />
    {!focused && !!value ? <View testID={displayTestID} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.display}>
      <Text variant="bodySmall" numberOfLines={1} ellipsizeMode="tail">{value}</Text>
    </View> : null}
    {value ? <Pressable testID={clearTestID} accessibilityRole="button" accessibilityLabel={t('placeImport.clearLink')}
      disabled={!editable} accessibilityState={{ disabled: !editable }} onPress={onClear} style={styles.clear}>
      <View style={styles.clearDisc}><Icon name="x" size={14} /></View>
    </Pressable> : null}
  </View>
}
