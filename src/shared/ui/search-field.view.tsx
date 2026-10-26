import type { Ref } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { styles } from './search-field.style'

export interface SearchFieldProps extends Omit<TextInputProps, 'accessibilityLabel' | 'placeholderTextColor'> {
  /**
   * Required: a placeholder is not a name. It disappears once the person
   * types, and screen readers treat it as a hint at best (#381).
   */
  accessibilityLabel: string
  ref?: Ref<TextInput>
}

/**
 * The search input (#381). Placeholder in `text.secondary` — `text.tertiary`
 * measures 1.6:1 and the hint is the only instruction the field gives.
 */
export function SearchField({ accessibilityLabel, style, ref, ...props }: SearchFieldProps) {
  const { theme } = useUnistyles()
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
      style={[styles.input, style]}
    />
  )
}
