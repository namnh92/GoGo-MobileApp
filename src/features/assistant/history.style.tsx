import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  screen: { flex: 1 },
  search: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[2] },
  list: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[7] },
  count: { paddingTop: theme.spacing[2] },
  group: { paddingTop: theme.spacing[5], paddingBottom: theme.spacing[2] },
  separator: { height: theme.spacing[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    minHeight: touchTarget.min,
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.primary,
    ...theme.shadows.cta,
  },
  newChatPressed: { backgroundColor: theme.accent.pressed },
  menu: { gap: theme.spacing[3] },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: touchTarget.min + 4,
    paddingHorizontal: theme.spacing[2],
    borderRadius: theme.radius.compact,
  },
  menuRowPressed: { backgroundColor: theme.surface.subtle },
  field: { gap: theme.spacing[1] },
  input: {
    ...theme.type.body,
    minHeight: 48,
    borderRadius: theme.radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    paddingHorizontal: theme.spacing[4],
    color: theme.text.primary,
  },
  actions: { gap: theme.spacing[2] },
}))
