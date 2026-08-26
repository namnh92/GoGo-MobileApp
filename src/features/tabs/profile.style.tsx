import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  name: { fontSize: 20, fontWeight: '800', color: neutral[900] },
  email: { fontSize: 13, color: neutral[500] },
  card: { marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[4] },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  coupleTagline: { fontSize: 13, fontWeight: '600', color: neutral[900] },
  coupleSince: { fontSize: 12, color: neutral[500] },
  prefLabel: { fontSize: 13, fontWeight: '600', color: neutral[900], marginBottom: spacing[2] },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing[3] },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  settingLabel: { fontSize: 15, fontWeight: '500', color: neutral[900] },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: neutral[50],
  },
  segmentBtnActive: { backgroundColor: brand.coral },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: neutral[500] },
  segmentLabelActive: { color: neutral[0] },
  logout: { alignItems: 'center', paddingVertical: spacing[3], marginBottom: spacing[6] },
  logoutLabel: { fontSize: 15, fontWeight: '600', color: brand.coral },
})
