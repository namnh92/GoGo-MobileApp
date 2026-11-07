import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  pageHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], backgroundColor: theme.redesign.canvas },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  interest: { borderRadius: radius.pill, backgroundColor: theme.surface.subtle, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  groupTitle: { marginHorizontal: spacing[5], marginBottom: spacing[2], textTransform: 'uppercase' },
  settingsCard: { marginHorizontal: spacing[4], marginBottom: spacing[5], overflow: 'hidden' },
  rowValue: { maxWidth: '28%' },
  banner: { marginHorizontal: spacing[4], marginBottom: spacing[5], padding: spacing[4], borderRadius: radius.compact, backgroundColor: theme.accent.soft, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  shortcutPress: { flex: 1, borderRadius: radius.card },
  confirm: { padding: spacing[5], gap: spacing[4] },
  headerCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[4],
    gap: spacing[3],
  },
  headerText: { flex: 1, minWidth: 0 },
  email: { marginTop: 2 },

  card: { marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[4], gap: spacing[3] },
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
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
    marginBottom: spacing[1],
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: touchTarget.min,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.hairline,
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingRowPressed: { backgroundColor: theme.surface.subtle },
  settingIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
  },
  inboxBadge: { marginLeft: 'auto', marginRight: spacing[2] },
  settingLead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexShrink: 1 },
  settingLabel: { flexShrink: 1 },

  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: theme.surface.canvas,
  },
  segmentBtnActive: { backgroundColor: theme.accent.primary },

  logout: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
    marginBottom: spacing[4],
  },
  signIn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginHorizontal: spacing[5],
    borderRadius: radius.button,
    backgroundColor: theme.accent.primary,
    marginBottom: spacing[4],
  },
  logoutError: { textAlign: 'center', paddingHorizontal: spacing[4] },
}))
