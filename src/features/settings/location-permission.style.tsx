import { StyleSheet } from 'react-native'

import { colors, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[3], gap: spacing[4] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.coralSoft,
  },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  status: { ...type.bodySmall, color: neutral[700] },
  statusBlocked: { ...type.bodySmall, color: brand.amber },
  body: { ...type.body, color: neutral[700] },
  note: { ...type.caption, color: neutral[500] },
  actions: { flexDirection: 'row', gap: spacing[2] },
})
