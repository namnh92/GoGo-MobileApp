import { StyleSheet } from 'react-native-unistyles'

import { touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[5], marginTop: theme.spacing[4], gap: theme.spacing[3] },
  /** Rating on the left, moderation state on the right: what the author checks first. */
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[3] },
  stars: { flexDirection: 'row', gap: 2 },
  starsRow: { flexDirection: 'row', gap: theme.spacing[1] },
  starTap: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: { alignSelf: 'flex-end' },
  input: {
    ...type.body,
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    borderRadius: theme.radius.card,
    padding: theme.spacing[3],
    color: theme.text.primary,
    textAlignVertical: 'top',
    backgroundColor: theme.surface.canvas,
  },
  actions: { flexDirection: 'row', gap: theme.spacing[2], alignItems: 'center' },
}))
