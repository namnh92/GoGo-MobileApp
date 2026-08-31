import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  body: { fontSize: 13, color: neutral[500], lineHeight: 19, marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  name: { fontSize: 15, fontWeight: '600', color: neutral[900] },
  meta: { fontSize: 12, color: neutral[500], marginTop: 2 },
  iconBtn: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  iconBtnDisabled: { opacity: 0.35 },
  iconLabel: { fontSize: 16, color: neutral[700] },
  removeLabel: { fontSize: 15, color: brand.red },
  error: { fontSize: 13, color: brand.red, marginTop: spacing[3] },
  saveBtn: { marginTop: spacing[4] },
})
