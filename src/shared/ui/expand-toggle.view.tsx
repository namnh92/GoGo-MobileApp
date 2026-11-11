import { Pressable } from 'react-native'
import { MaterialIcon } from './material-icon'
import { styles } from './expand-toggle.style'

/** Shared calendar/section disclosure: same glyph, target and accessible state. */
export function ExpandToggle({ expanded, accessibilityLabel, onPress, testID }: {
  expanded: boolean
  accessibilityLabel: string
  onPress: () => void
  testID?: string
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
    accessibilityLabel={accessibilityLabel} testID={testID} style={styles.toggle} onPress={onPress}>
    <MaterialIcon name={expanded ? 'keyboardDoubleArrowUp' : 'keyboardDoubleArrowDown'} color="accent.primary" />
  </Pressable>
}
