import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  header: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPlaceBtn: {
    marginLeft: 'auto',
  },
  filterRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  list: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  /** ADM-205 — province, then commune; each header is a screen-reader heading. */
  group: { marginBottom: spacing[6] },
  groupHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  subgroup: { marginBottom: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  gridItem: { width: '48%' },
  unavailable: { width: '48%', padding: spacing[3], gap: spacing[2] },
}))
