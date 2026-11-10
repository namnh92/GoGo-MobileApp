import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  pending: { paddingHorizontal: spacing[5], gap: spacing[3] },
  errorWrap: { flex: 1 },
  seedHint: { marginBottom: spacing[3], marginTop: -spacing[2] },
  seedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap, alignItems: 'center' },
  moodTitle: { marginBottom: spacing[3] },
  sectionTitle: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  error: { marginTop: spacing[4] },
}))
