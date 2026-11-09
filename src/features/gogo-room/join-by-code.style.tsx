import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { flexGrow: 1, paddingHorizontal: spacing[4] },
  codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.redesign.container, borderRadius: 8, paddingRight: spacing[2] },
  codeInput: { flex: 1, minWidth: 0, backgroundColor: theme.redesign.container, height: 56 },
  actions: { marginTop: spacing[6], gap: spacing[3] },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: theme.redesign.low, padding: spacing[3], borderRadius: radius.compact, marginTop: spacing[4] },
  tipText: { flex: 1 },
  body: { marginBottom: spacing[4], marginTop: spacing[4], textAlign: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  card: { borderRadius: radius.compact, padding: spacing[4], gap: spacing[3] },
  input: {
    ...type.body,
    // A line height on a single-line field makes iOS wrap a long value; the fixed height centres it.
    lineHeight: undefined,
    height: touchTarget.min,
    borderRadius: radius.compact,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.redesign.low,
  },
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
