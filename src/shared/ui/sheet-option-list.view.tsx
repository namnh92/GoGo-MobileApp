import { Pressable, View } from 'react-native'
import { IconChip } from './icon-chip.view'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Text } from './text'
import { styles } from './sheet-option-list.style'

export interface SheetOption {
  key: string
  icon: MaterialIconName
  title: string
  body: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

/** Raised surface and tint carry hierarchy; only row separators have a stroke. */
export function SheetOptionList({ options }: { options: SheetOption[] }) {
  return <View testID="sheet-option-list" style={styles.group}>{options.map((option, index) => (
    <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={option.title}
      accessibilityState={{ disabled: !!option.disabled }} disabled={option.disabled} onPress={option.onPress}
      style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed, option.disabled && styles.disabled]}>
      <IconChip icon={option.icon} destructive={option.destructive} />
      <View style={styles.copy}>
        <Text variant="avatarAction" color={option.destructive ? 'status.dangerText' : 'text.primary'}>{option.title}</Text>
        <Text variant="avatarCaption" color={option.destructive ? 'status.dangerText' : 'text.secondary'}>{option.body}</Text>
      </View>
      {!option.destructive ? <MaterialIcon name="chevronRight" size={16} color="text.secondary" /> : null}
    </Pressable>
  ))}</View>
}
