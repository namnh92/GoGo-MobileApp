import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget } from './tokens'

export const WHEEL_ROW = touchTarget.min
export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', gap: spacing[4], marginVertical: spacing[4] },
  column: { flex: 1 },
  label: { textAlign: 'center', marginBottom: spacing[2] },
  window: { height: WHEEL_ROW * 3, overflow: 'hidden' },
  content: { paddingVertical: WHEEL_ROW },
  item: { height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center' },
  selection: { position: 'absolute', top: WHEEL_ROW, left: 0, right: 0, height: WHEEL_ROW, borderRadius: radius.compact, backgroundColor: theme.accent.soft },
}))
