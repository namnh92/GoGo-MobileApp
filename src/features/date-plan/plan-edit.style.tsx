import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  body: { marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  meta: { marginTop: 2 },
  iconBtn: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  iconBtnDisabled: { opacity: 0.35 },
  error: { marginTop: spacing[3] },
  saveBtn: { marginTop: spacing[4] },
})
