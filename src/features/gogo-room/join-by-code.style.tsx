import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { marginBottom: spacing[4], marginTop: spacing[4], textAlign: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  card: { padding: spacing[5], gap: spacing[3] },
  input: {
    ...type.body,
    // A line height on a single-line field makes iOS wrap a long value; the fixed height centres it.
    lineHeight: undefined,
    height: touchTarget.min,
    borderRadius: radius.compact,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
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
