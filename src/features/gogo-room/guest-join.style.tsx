import { StyleSheet } from 'react-native'
import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  badge: {
    backgroundColor: brand.coralGhost,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[4],
  },
  badgeLabel: { ...type.label, color: brand.coral },
  title: {
    ...type.title1,
    color: neutral[900],
    textAlign: 'center',
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  pairName: { ...type.label, color: neutral[900] },
  details: { borderRadius: radius.hero, padding: spacing[5], marginBottom: spacing[6] },
  detailsTitle: { ...type.bodySmall, fontWeight: '700', color: neutral[900], marginBottom: spacing[3] },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  detailLabel: { ...type.bodySmall, color: neutral[500] },
  noAccount: { ...type.bodySmall, textAlign: 'center', color: neutral[500] },
  nameInput: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  error: {
    ...type.bodySmall,
    color: brand.red,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
})
