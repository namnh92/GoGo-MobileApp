import { StyleSheet } from 'react-native'
import { colors, radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[6] },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  title: { ...type.display, color: colors.neutral[900] },
  body: { ...type.body, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...type.body, fontWeight: '700', color: colors.neutral[900] },
  rowSub: { ...type.bodySmall, color: colors.neutral[500] },
  sectionTitle: { ...type.title2, color: colors.neutral[900], marginTop: spacing[4], marginBottom: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  radiusBtn: {
    width: '48%',
    height: 48,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusLabel: { ...type.label },
  locationFallback: {
    ...type.bodySmall,
    color: colors.brand.amber,
    marginTop: spacing[2],
  },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[3] },
})
