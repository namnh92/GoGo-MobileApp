import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const CELL = touchTarget.min

export const styles = StyleSheet.create(theme => ({
  calendar: { borderRadius: radius.compact, backgroundColor: theme.surface.card, padding: spacing[2], marginBottom: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] },
  headTitle: { flex: 1 },
  iconBtn: { width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
  iconBtnOff: { opacity: 0.35 },
  expand: { minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  monthTitle: { flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' },
  cellWrap: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { backgroundColor: theme.accent.primary },
  cellOff: { opacity: 0.4 },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.accent.primary,
  },
  todayDotOnSelected: { backgroundColor: theme.accent.onAccent },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[2] },
  timeRow: { gap: chipRowGap, paddingRight: spacing[2] },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    minHeight: touchTarget.min,
    paddingHorizontal: spacing[4],
    borderRadius: radius.compact,
    backgroundColor: theme.accent.soft,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  summaryInvalid: { backgroundColor: theme.status.dangerSoft, borderColor: theme.status.danger },
  done: { marginTop: spacing[4] },
}))
