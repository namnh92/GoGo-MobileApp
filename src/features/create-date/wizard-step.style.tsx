import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  chrome: { flexShrink: 0 },
  content: { flex: 1, minHeight: 0, overflow: 'hidden' },
  progress: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[6], gap: spacing[2] },
  progressLabels: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], justifyContent: 'space-between' },
  context: { flex: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.surface.subtle },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.accent.primary },
}))
