import { StyleSheet } from 'react-native-unistyles'

import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  linkCard: { marginTop: spacing[2], gap: spacing[1] },
  linkRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', minHeight: 44 },
  linkInput: { ...theme.type.bodySmall, flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.redesign.container, color: theme.redesign.ink },
  list: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  /** ADM-205 — province, then commune; each header is a screen-reader heading. */
  group: { marginBottom: spacing[3] },
  groupHeader: { minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  groupTitle: { flexShrink: 1 },
  countBadge: { minWidth: 24, minHeight: 24, paddingHorizontal: spacing[1], borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.subtle },
  cityAction: { marginLeft: 'auto', flexShrink: 0 },
  saveLink: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  feedback: { paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  subgroup: { marginBottom: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  placeItem: { width: '100%' },
  unavailable: { width: '100%', padding: spacing[3], gap: spacing[2] },
  unavailableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  unavailableText: { flex: 1 },
}))
