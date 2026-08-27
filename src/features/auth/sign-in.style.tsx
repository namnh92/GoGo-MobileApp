import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: neutral[900],
    marginBottom: spacing[2],
  },
  body: {
    fontSize: 14,
    color: neutral[500],
    lineHeight: 20,
    marginBottom: spacing[5],
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: neutral[100],
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing[5],
  },
  tab: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: neutral[0] },
  tabLabel: { fontSize: 14, fontWeight: '600', color: neutral[500] },
  tabLabelActive: { color: neutral[900], fontWeight: '700' },
  card: { padding: spacing[5], gap: spacing[4] },
  field: { gap: spacing[2] },
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
  inputInvalid: { borderColor: brand.red },
  hint: { fontSize: 12, color: neutral[500] },
  fieldError: { fontSize: 12, color: brand.red },
  formError: {
    fontSize: 13,
    color: brand.red,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  footnote: { fontSize: 12, color: neutral[500], textAlign: 'center' },
})
