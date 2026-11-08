import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  softChip: { minHeight: 44, borderRadius: 999, borderWidth: 0, backgroundColor: theme.redesign.low },
  softChipSelected: { backgroundColor: theme.mode === 'dark' ? theme.redesign.moodSelected : theme.accent.soft },
  moodChip: { minHeight: 36, height: 36, paddingHorizontal: 14, paddingVertical: 0, borderWidth: 0, borderRadius: 999, backgroundColor: theme.redesign.card, ...theme.shadows.card },
  moodChipSelected: { backgroundColor: theme.redesign.moodSelected },
  discoveryChip: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.redesign.low, borderWidth: 0 },
  discoveryChipSelected: { backgroundColor: theme.mode === 'dark' ? theme.redesign.moodSelected : theme.redesign.primarySoft },
  remove: { minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
  host: { maxWidth: '100%', flexShrink: 1, minWidth: touchTarget.min, minHeight: touchTarget.min, justifyContent: 'center' },
  chip: {
    maxWidth: '100%',
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  chipLabel: { flexShrink: 1 },
  chip_default: { backgroundColor: theme.surface.card, borderColor: theme.border.hairline },
  chip_selected: { backgroundColor: theme.accent.primary, borderColor: theme.accent.primary },
  chip_disabled: { backgroundColor: theme.surface.subtle, borderColor: theme.surface.subtle },
  chip_info: { backgroundColor: theme.status.infoSoft, borderColor: theme.status.infoSoft },
  chip_positive: { backgroundColor: theme.status.successSoft, borderColor: theme.status.successSoft },
  chip_warning: { backgroundColor: theme.status.warningSoft, borderColor: theme.status.warningSoft },

}))
