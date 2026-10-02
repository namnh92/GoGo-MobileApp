import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: {
    marginBottom: spacing[2],
  },
  body: {
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
  tabDisabled: { opacity: 0.5 },
  card: { padding: spacing[5], gap: spacing[4] },
  field: { gap: spacing[2] },
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
  formError: {
    marginTop: spacing[4],
    textAlign: 'center',
  },
  footnote: { textAlign: 'center' },
})
