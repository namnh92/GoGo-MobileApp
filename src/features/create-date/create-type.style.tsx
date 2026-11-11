import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
  nameLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[6], marginBottom: spacing[2] },
  nameInput: {
    ...type.body,
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
    minHeight: 48,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: theme.border.hairline,
    borderRadius: radius.compact,
  },
  title: {
    marginTop: spacing[2],
  },
  option: {
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
    borderRadius: radius.card,
    padding: spacing[4],
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  optionActive: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  options: { gap: spacing[3] },
  optionBody: { flex: 1 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileActive: { backgroundColor: theme.accent.primary },
  optionDesc: { marginTop: 4 },
}))
