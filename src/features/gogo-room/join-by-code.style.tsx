import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { flexGrow: 1, paddingHorizontal: spacing[4] },
  actions: { marginTop: spacing[6], gap: spacing[3] },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: theme.surface.low, padding: spacing[3], borderRadius: radius.compact, marginTop: spacing[4] },
  tipText: { flex: 1 },
  body: { marginBottom: spacing[4], marginTop: spacing[4], textAlign: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  card: { borderRadius: radius.compact, padding: spacing[4], gap: spacing[3] },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.status.dangerSoft,
  },
  errorText: { flex: 1 },
  footnote: { textAlign: 'center' },
}))
