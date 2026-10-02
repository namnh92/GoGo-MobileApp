import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  headerRow: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  email: { marginTop: 2 },

  card: { marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[4] },
  caption: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },

  /** Saved / Plans / Reviews — the three places a profile actually leads. */
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  shortcut: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    alignItems: 'center',
    gap: 2,
    minHeight: touchTarget.min + 32,
    justifyContent: 'center',
  },
  shortcutLabel: { textAlign: 'center' },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: touchTarget.min,
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },

  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: neutral[50],
  },
  segmentBtnActive: { backgroundColor: theme.accent.primary },

  logout: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    paddingVertical: spacing[3],
    marginBottom: spacing[6],
  },
  logoutError: { textAlign: 'center', paddingHorizontal: spacing[4] },
}))
