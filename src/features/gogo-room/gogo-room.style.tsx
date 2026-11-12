import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[8], gap: theme.spacing[2] },
  actions: { gap: theme.spacing[2] },
  waitingNotice: { flexDirection: 'row', gap: theme.spacing[3], padding: theme.spacing[4], borderRadius: theme.radius.compact, backgroundColor: theme.surface.subtle },
  sectionCard: { marginBottom: theme.spacing[4], gap: theme.spacing[3] },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[3],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
    minHeight: touchTarget.min,
  },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoIcon_accent: { backgroundColor: theme.accent.soft },
  infoIcon_info: { backgroundColor: theme.status.infoSoft },
  infoIcon_success: { backgroundColor: theme.status.successSoft },
  infoIcon_warning: { backgroundColor: theme.status.warningSoft },
  infoValue: { flex: 1 },
  stackedBtn: { marginTop: theme.spacing[2] },
  actionHint: { textAlign: 'center' },
  error: { textAlign: 'center', marginTop: theme.spacing[3] },
  notice: {
    textAlign: 'center',
    marginTop: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
  },

  sectionTitle: { flex: 1 },
}))
