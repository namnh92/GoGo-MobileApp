import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { neutral } = colors

/** PROF-APP-006 — the date-of-birth block in account information. */
export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  header: { gap: spacing[1] },
  input: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  saveBtn: { flex: 1 },
  notice: { textAlign: 'center' },
})
