import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

/** PROF-APP-006 — the date-of-birth block in account information. */
export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  header: { gap: spacing[1] },
  sectionTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  sectionBody: { ...type.bodySmall, color: neutral[500] },
  value: { ...type.body, color: neutral[900] },
  unset: { ...type.body, color: neutral[500] },
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
  hint: { ...type.caption, color: neutral[500] },
  problem: { ...type.bodySmall, color: brand.red },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  saveBtn: { flex: 1 },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
})
