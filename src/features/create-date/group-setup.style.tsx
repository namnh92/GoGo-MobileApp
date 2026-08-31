import { StyleSheet } from 'react-native'

import { colors, glassFx, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: {
    ...type.display,
    color: neutral[900],
    marginTop: spacing[2],
  },
  stepper: {
    borderRadius: radius.hero,
    padding: spacing[5],
    marginTop: spacing[7],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnLabel: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  count: { ...type.title1, color: neutral[900] },
  sectionTitle: {
    ...type.title2,
    color: neutral[900],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },

  /**
   * A two-way choice is a segmented control, not two stacked radio rows: the
   * options are alternatives to each other, and side by side is what says so.
   */
  segmented: {
    flexDirection: 'row',
    backgroundColor: neutral[100],
    borderRadius: radius.compact,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget.min,
    borderRadius: radius.compact - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    gap: 2,
  },
  segmentActive: {
    backgroundColor: glassFx.solid,
    shadowColor: neutral[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentLabel: { ...type.label, color: neutral[500] },
  segmentLabelActive: { color: brand.coral, fontWeight: '700' },
  helper: { ...type.bodySmall, color: neutral[500], marginTop: spacing[3] },
})
