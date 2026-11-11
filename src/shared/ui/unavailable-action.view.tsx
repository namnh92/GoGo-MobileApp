import { Pressable, View } from 'react-native'
import { Text } from './text'
import { styles } from './unavailable-action.style'

/** No handler or navigation; the reason remains visible and announced. */
export function UnavailableAction({ label, reason }: { label: string; reason: string }) {
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" disabled accessibilityState={{ disabled: true }} accessibilityLabel={label} accessibilityHint={reason} style={styles.action}>
      <Text variant="introCaption" color="border.outline">{label}</Text>
    </Pressable>
    <Text variant="introCaption" color="border.outline" style={styles.reason}>{reason}</Text>
  </View>
}
