import { StyleSheet } from 'react-native-unistyles'
import { radius } from './tokens'

export const styles = StyleSheet.create(theme => ({
  field: { position: 'relative', minWidth: 0, height: 52 },
  input: {
    ...theme.type.bodySmall,
    height: 52, width: '100%', minWidth: 0, flexShrink: 1,
    borderRadius: radius.compact, backgroundColor: theme.surface.low,
    borderWidth: 1, borderColor: theme.border.neutral, color: theme.text.primary,
    paddingLeft: 40, paddingRight: 48, paddingVertical: 0,
    // Native single-line editing must use font metrics rather than paragraph wrapping.
    lineHeight: undefined, textAlignVertical: 'center', marginBottom: 0,
  },
  // Blend only the editor text into its surface; keep the field and error border visible.
  unfocused: { color: theme.surface.low },
  error: { borderColor: theme.status.danger },
  display: { position: 'absolute', top: 0, bottom: 0, left: 40, right: 48, justifyContent: 'center' },
  location: { position: 'absolute', left: 12, top: 16, zIndex: 1 },
  clear: { position: 'absolute', right: 0, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearDisc: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.surface.highest, alignItems: 'center', justifyContent: 'center' },
}))
