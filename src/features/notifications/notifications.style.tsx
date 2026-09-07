import { StyleSheet } from 'react-native'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.card,
    marginBottom: spacing[2],
  },
  rowUnread: { borderWidth: 1, borderColor: brand.coralSoft },
  dotColumn: { width: 10, alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.coral },
  kind: { ...type.body, color: neutral[700] },
  kindUnread: { fontWeight: '700', color: neutral[900] },
  time: { ...type.caption, color: neutral[500], marginTop: 2 },
})
