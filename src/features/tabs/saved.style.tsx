import { StyleSheet } from 'react-native-unistyles'

import { spacing, tabRootSpacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  linkCard: { gap: spacing[1] },
  linkRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', minHeight: 52 },
  linkField: { flex: 1, minWidth: 0, height: 52 },
  linkSave: { height: 52 },
  list: { paddingHorizontal: spacing[5] },
  /** ADM-205 — province, then commune; each header is a screen-reader heading. */
  group: { marginBottom: tabRootSpacing.section },
  groupHeader: { minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: tabRootSpacing.headingContent },
  wardHeader: { minHeight: spacing[6] },
  groupTitle: { flexShrink: 1 },
  countBadge: { minWidth: 24, minHeight: 24, paddingHorizontal: spacing[1], borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.subtle },
  cityAction: { marginLeft: 'auto', flexShrink: 0 },
  saveLink: { paddingHorizontal: spacing[5], paddingBottom: tabRootSpacing.section },
  feedback: { paddingHorizontal: spacing[5], paddingBottom: spacing[2] },
  subgroup: { marginBottom: tabRootSpacing.section },
  lastSubgroup: { marginBottom: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  placeItem: { width: '100%' },
  unavailable: { width: '100%', padding: spacing[3], gap: spacing[2] },
  unavailableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  unavailableText: { flex: 1 },
}))
