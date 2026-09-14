import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  section: { marginTop: spacing[6] },
  title: { ...type.title2, color: neutral[900] },
  source: { ...type.caption, color: neutral[500], marginTop: spacing[1] },
  orderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  fallback: { ...type.caption, color: neutral[500], marginTop: spacing[3] },
  list: { gap: spacing[3], marginTop: spacing[3] },
  row: {
    borderRadius: radius.card,
    backgroundColor: neutral[50],
    padding: spacing[4],
    gap: spacing[1],
  },
  rowContent: { gap: spacing[1] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  author: { ...type.label, color: neutral[900], flexShrink: 1 },
  rating: { ...type.label, color: neutral[900] },
  date: { ...type.caption, color: neutral[500] },
  text: { ...type.body, color: neutral[700] },
  helpfulBtn: {
    alignSelf: 'flex-start',
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    marginTop: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: neutral[300],
    backgroundColor: neutral[0],
  },
  helpfulBtnActive: { borderColor: brand.coral },
  helpfulPressed: { opacity: 0.85 },
  helpfulLabel: { ...type.label, color: neutral[700] },
  helpfulLabelActive: { color: neutral[900] },
  failure: { ...type.caption, color: neutral[700] },
  empty: { ...type.bodySmall, color: neutral[500], marginTop: spacing[3] },
  notice: { marginTop: spacing[3], gap: spacing[2], alignItems: 'flex-start' },
  noticeLabel: { ...type.bodySmall, color: neutral[500] },
})
