import { StyleSheet } from 'react-native-unistyles'

/**
 * Each tone is a `*Soft` pill with its `*Text` label — the pairs the contrast
 * test measures at ≥ 4.5:1 (`__tests__/contrast.test.ts`).
 */
export const styles = StyleSheet.create(theme => ({
  stitchNeutral: { backgroundColor: theme.redesign.low, paddingVertical: 4, gap: 4 },
  stitchViolet: { backgroundColor: theme.redesign.violetSoft, paddingHorizontal: 12, paddingVertical: 4, gap: 4 },
  stitchGreen: { backgroundColor: theme.redesign.green, gap: 4 },
  stitchWhite: { backgroundColor: theme.redesign.bubble, borderRadius: 4 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[2],
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  accent: { backgroundColor: theme.accent.soft },
  neutral: { backgroundColor: theme.surface.subtle },
  info: { backgroundColor: theme.status.infoSoft },
  success: { backgroundColor: theme.status.successSoft },
  warning: { backgroundColor: theme.status.warningSoft },
  danger: { backgroundColor: theme.status.dangerSoft },
}))
