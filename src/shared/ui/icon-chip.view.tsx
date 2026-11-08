import { View } from 'react-native'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { styles } from './icon-chip.style'

/** Decorative icon on a soft tint, shared by sheet rows and permission prompts. */
export function IconChip({ icon, destructive = false }: { icon: MaterialIconName; destructive?: boolean }) {
  return <View testID="sheet-icon-chip" style={[styles.chip, destructive && styles.danger]}>
    <MaterialIcon name={icon} color={destructive ? 'status.dangerText' : 'accent.primary'} />
  </View>
}
