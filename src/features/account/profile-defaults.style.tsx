import { StyleSheet } from 'react-native-unistyles'

import { shadows, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 64, padding: spacing[3], borderRadius: 8, backgroundColor: theme.redesign.low },
  areaIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface.card, alignItems: 'center', justifyContent: 'center' },
  areaClear: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[1] },
  card: { padding: spacing[4], gap: spacing[4], borderRadius: 12, ...shadows.stitch },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.redesign.primarySoft },
  titleText: { flex: 1, gap: spacing[1] },
  section: { gap: spacing[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[1] },
  field: { padding: spacing[3], gap: spacing[3], borderRadius: 12, ...shadows.stitch },
  budgetGroup: { gap: spacing[2] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  value: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44, padding: spacing[3], borderRadius: 8, backgroundColor: theme.redesign.low },
  budgetSelected: { backgroundColor: theme.accent.soft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: theme.redesign.outline, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.accent.onSoft },
  pressed: { backgroundColor: theme.redesign.container },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: theme.redesign.violetSoft, padding: spacing[3], borderRadius: 12 },
  notice: { textAlign: 'center' },
}))
