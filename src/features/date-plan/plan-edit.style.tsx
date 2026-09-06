import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  body: { ...type.bodySmall, color: neutral[500], marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  name: { ...type.body, fontWeight: '600', color: neutral[900] },
  meta: { ...type.caption, color: neutral[500], marginTop: 2 },
  iconBtn: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  iconBtnDisabled: { opacity: 0.35 },
  iconLabel: { ...type.body, color: neutral[700] },
  removeLabel: { ...type.body, color: brand.red },
  error: { ...type.bodySmall, color: brand.red, marginTop: spacing[3] },
  saveBtn: { marginTop: spacing[4] },
})
