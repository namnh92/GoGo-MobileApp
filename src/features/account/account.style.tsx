import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  label: { ...type.label, color: neutral[700] },
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
  email: { ...type.bodySmall, color: neutral[500] },
  saveBtn: { marginTop: spacing[2] },
  sectionTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  sectionBody: { ...type.bodySmall, color: neutral[500] },
  deleteBtn: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.red,
  },
  deleteLabel: { ...type.body, fontWeight: '700', color: brand.red },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center', marginTop: spacing[4] },
})
