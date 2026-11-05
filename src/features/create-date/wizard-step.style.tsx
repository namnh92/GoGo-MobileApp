import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  progress: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[2] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.surface.subtle },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.accent.primary },
}))
