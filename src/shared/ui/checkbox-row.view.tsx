import type { ReactNode } from 'react'
import { Pressable } from 'react-native'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './checkbox-row.style'

/** One checklist row for contribution forms and room preferences. */
export function CheckboxRow({ label, checked, disabled = false, accessibilityHint, onPress, leading }: {
  label: string
  checked: boolean
  disabled?: boolean
  accessibilityHint?: string
  onPress: () => void
  leading?: ReactNode
}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityHint={accessibilityHint}
    accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.row, checked && styles.selected, disabled && styles.disabled]}>
    {leading}
    <Text variant="introSmall" color={disabled ? 'text.secondary' : 'text.primary'} style={styles.label}>{label}</Text>
    <MaterialIcon name={checked ? 'checkbox' : 'checkboxBlank'} color={disabled ? 'text.secondary' : 'text.primary'} />
  </Pressable>
}
