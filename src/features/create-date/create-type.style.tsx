import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  nameLabel: { marginTop: spacing[4], marginBottom: spacing[2] },
  nameInput: { ...type.body, color: neutral[900], minHeight: 48, padding: spacing[3], borderWidth: 1, borderColor: neutral[300], borderRadius: radius.compact },
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
  optionActive: {
    backgroundColor: theme.accent.primary,
    borderWidth: 1,
    borderColor: theme.accent.pressed,
  },
  // Pressed is a colour change only (#382).
  optionPressed: { backgroundColor: theme.surface.subtle },
  optionActivePressed: { backgroundColor: theme.accent.pressed },
  optionDesc: { marginTop: 4 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
