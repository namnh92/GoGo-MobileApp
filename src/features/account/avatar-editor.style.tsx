import { StyleSheet } from 'react-native-unistyles'

// Stitch's photo editing workspace stays dark in either application theme.
export const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.photoEditor.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.photoEditor.line },
  title: { flex: 1, textAlign: 'center' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  reset: { minWidth: 60, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  viewport: { borderRadius: 24, overflow: 'hidden', backgroundColor: theme.photoEditor.black },
  mask: { position: 'absolute', top: 0, left: 0 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'absolute', top: 14, alignSelf: 'center', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: theme.photoEditor.pill },
  badge: { position: 'absolute', right: 12, bottom: 12, backgroundColor: theme.photoEditor.pill, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2 },
  dock: { padding: 16, gap: 16, backgroundColor: theme.photoEditor.dock, borderTopWidth: 1, borderTopColor: theme.photoEditor.line },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderTouch: { flex: 1, height: 44, justifyContent: 'center', marginHorizontal: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.photoEditor.line },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, marginLeft: -10, backgroundColor: theme.accent.primary, borderWidth: 2.5, borderColor: theme.photoEditor.white },
  tools: { flexDirection: 'row', gap: 10 },
  tool: { flex: 1, minHeight: 64, padding: 10, gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.photoEditor.raised, borderWidth: 1, borderColor: theme.photoEditor.line },
  another: { flex: 2, flexDirection: 'row', minHeight: 50, gap: 6, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.photoEditor.raised, borderWidth: 1, borderColor: theme.photoEditor.pressed },
  confirm: { flex: 3, flexDirection: 'row', minHeight: 50, gap: 8, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.accent.primary },
  actionText: { flexShrink: 1, textAlign: 'center' },
  pressed: { backgroundColor: theme.photoEditor.pressed },
  confirmPressed: { backgroundColor: theme.accent.pressed },
}))
