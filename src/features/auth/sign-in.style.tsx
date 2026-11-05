import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing[1],
    backgroundColor: theme.surface.subtle,
    borderRadius: theme.radius.pill,
    padding: theme.spacing[1],
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[6],
  },
  tab: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  tabActive: { backgroundColor: theme.surface.card, ...theme.shadows.card },
  tabDisabled: { opacity: 0.5 },
  title: {
    marginBottom: theme.spacing[2],
  },
  body: {
    marginBottom: theme.spacing[6],
  },
  form: { gap: theme.spacing[4] },
  field: { gap: theme.spacing[2] },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: 48,
    paddingHorizontal: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.border.hairline,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
  },
  inputRowInvalid: { borderColor: theme.status.danger },
  input: {
    ...theme.type.body,
    // A line height on a single-line field makes iOS wrap a long value; the fixed height centres it.
    lineHeight: undefined,
    flex: 1,
    height: touchTarget.min,
    color: theme.text.primary,
  },
  formError: {
    marginTop: theme.spacing[4],
    textAlign: 'center',
  },
  actions: { marginTop: theme.spacing[5] },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    marginTop: theme.spacing[7],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  noteText: { flex: 1 },
}))
