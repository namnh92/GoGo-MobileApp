import { StyleSheet } from 'react-native-unistyles'

import { colors, spacing, touchTarget } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  body: { marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pending: { paddingHorizontal: spacing[5], gap: spacing[3] },
  errorWrap: { flex: 1 },
  seedHint: { marginBottom: spacing[3], marginTop: -spacing[2] },
  seedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  seedAddBtn: {
    minHeight: touchTarget.min - 12,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: neutral[300],
  },
  sectionTitle: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  error: { marginTop: spacing[4] },
})
