import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  nameLabel: { marginTop: spacing[4], marginBottom: spacing[2] },
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
    borderRadius: radius.hero,
    padding: spacing[5],
    flexDirection: 'row',
    gap: spacing[4],
    alignItems: 'flex-start',
  },
  // Selected is a tint and a ring plus a check, so it is not colour alone.
  optionActive: {
    backgroundColor: theme.accent.soft,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  // Pressed is a colour change only (#382).
  optionPressed: { backgroundColor: theme.surface.subtle },
  optionActivePressed: { backgroundColor: theme.accent.soft, borderColor: theme.accent.pressed },
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
