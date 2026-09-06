import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: {
    ...type.display,
    color: neutral[900],
    marginBottom: spacing[2],
  },
  body: {
    ...type.bodySmall,
    color: neutral[500],
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
  tabLabel: { ...type.bodySmall, fontWeight: '600', color: neutral[500] },
  tabLabelActive: { color: neutral[900], fontWeight: '700' },
  card: { padding: spacing[5], gap: spacing[4] },
  field: { gap: spacing[2] },
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
  inputInvalid: { borderColor: brand.red },
  hint: { ...type.caption, color: neutral[500] },
  fieldError: { ...type.caption, color: brand.red },
  formError: {
    ...type.bodySmall,
    color: brand.red,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  footnote: { ...type.caption, color: neutral[500], textAlign: 'center' },
})
