import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { marginTop: spacing[2], marginBottom: spacing[5] },
  choices: { gap: spacing[2] },
  pending: { paddingHorizontal: spacing[4], gap: spacing[3] },
  errorWrap: { flex: 1 },
  seedHint: { marginBottom: spacing[3], marginTop: -spacing[2] },
  seedList: { flexDirection: 'column', gap: spacing[3] },
  seedPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  seedCard: { flex: 1 },
  addPlace: { alignItems: 'flex-start', marginTop: spacing[2] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[3] },
  sectionHeading: { flex: 1 },
  sectionTitle: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  error: { marginTop: spacing[4] },
})
