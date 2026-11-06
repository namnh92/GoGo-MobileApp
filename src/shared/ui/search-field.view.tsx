import type { Ref } from 'react'
import { Pressable, View, type TextInputProps } from 'react-native'
import { TextInput, type TextInputRef } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'

import { useTranslation } from 'react-i18next'
import { MaterialIcon } from './material-icon'
import { styles } from './search-field.style'

export interface SearchFieldProps extends Omit<TextInputProps, 'accessibilityLabel' | 'placeholderTextColor'> {
  /**
   * Required: a placeholder is not a name. It disappears once the person
   * types, and screen readers treat it as a hint at best (#381).
   */
  appearance?: 'default' | 'discovery'
  accessibilityLabel: string
  ref?: Ref<TextInputRef>
}

/**
 * The search input (#381). Placeholder in `text.secondary` — `text.tertiary`
 * measures 1.6:1 and the hint is the only instruction the field gives.
 */
export function SearchField({ accessibilityLabel, style, ref, appearance = 'default', ...props }: SearchFieldProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  if (appearance === 'discovery') return <View style={[styles.discoveryShell, style]}>
    <MaterialIcon name="search" size={22} color="redesign.secondary" />
    <TextInput ref={ref} accessibilityLabel={accessibilityLabel} placeholderTextColor={theme.redesign.secondary} autoCorrect={false} autoCapitalize="none" returnKeyType="search" {...props} clearButtonMode="never" style={styles.discoveryInput} />
    {props.value ? <Pressable accessibilityRole="button" accessibilityLabel={t('discovery.clearQuery')} style={styles.clear} onPress={() => props.onChangeText?.('')}><MaterialIcon name="close" size={18} color="redesign.secondary" /></Pressable> : null}
  </View>
  return (
    <TextInput
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={theme.text.secondary}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      clearButtonMode="while-editing"
      {...props}
      allowFontScaling={false}
      style={[styles.input, style]}
    />
  )
}
