import { StyleSheet } from 'react-native'

import { colors, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[4] },
  sectionTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  sectionBody: { ...type.bodySmall, color: neutral[500] },
  fieldLabel: { ...type.label, color: neutral[700] },
  field: { gap: spacing[2] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  value: { ...type.body, color: neutral[900], flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  hint: { ...type.caption, color: neutral[500] },
  problem: { ...type.bodySmall, color: brand.amber },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
})
