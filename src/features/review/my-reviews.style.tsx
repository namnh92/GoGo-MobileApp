import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  starsRow: { flexDirection: 'row', gap: spacing[2] },
  starDim: { opacity: 0.3 },
  input: {
    ...type.body,
    minHeight: 88,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.card,
    padding: spacing[3],
    color: neutral[900],
    textAlignVertical: 'top',
    backgroundColor: neutral[0],
  },
  actions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
})
