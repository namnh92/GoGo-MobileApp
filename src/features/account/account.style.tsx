import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  label: { fontSize: 13, fontWeight: '600', color: neutral[700] },
  input: {
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    fontSize: 16,
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  email: { fontSize: 13, color: neutral[500] },
  saveBtn: { marginTop: spacing[2] },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: neutral[900] },
  sectionBody: { fontSize: 13, color: neutral[500], lineHeight: 19 },
  deleteBtn: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.red,
  },
  deleteLabel: { fontSize: 15, fontWeight: '700', color: brand.red },
  notice: { fontSize: 13, color: neutral[500], textAlign: 'center', marginTop: spacing[4] },
})
