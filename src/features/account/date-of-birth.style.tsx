import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

/** PROF-APP-006 — the date-of-birth block in account information. */
export const styles = StyleSheet.create(theme => ({
  inputWrap: { position: 'relative' },
  calendarInput: { paddingRight: 40, borderRadius: 12, borderWidth: 1, borderColor: theme.border.outline },
  activeInput: { borderWidth: 1, borderColor: theme.accent.primary },
  calendar: { position: 'absolute', right: 14, top: 14, pointerEvents: 'none' },
  embedded: { gap: spacing[2] },
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  header: { flex: 1, gap: spacing[1] },
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  saveBtn: { flex: 1 },
  notice: { textAlign: 'center' },
}))
