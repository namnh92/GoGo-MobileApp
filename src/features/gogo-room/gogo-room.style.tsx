import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[8], gap: theme.spacing[2] },
  actions: { gap: theme.spacing[2] },
  badgeRow: { alignSelf: 'flex-start' },
  hero: { marginBottom: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.surface.subtle },
  groupMembers: { backgroundColor: theme.surface.canvas, padding: 0, borderWidth: 0 },
  hostMemberRow: { backgroundColor: theme.surface.card, padding: theme.spacing[4], borderRadius: theme.radius.card },
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

  /** Info cards (#293 §3): padded `Card`, caption heading, body content. */
  codeCard: { marginBottom: theme.spacing[4] },
  cardHeading: { marginBottom: theme.spacing[2] },
  inviteNote: { marginBottom: theme.spacing[3] },
  createInvite: { marginBottom: theme.spacing[3] },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
  },
  code: { flex: 1, letterSpacing: 0.5, color: theme.accent.primary },
  copyBtn: { flexShrink: 0 },
  /** Per-member status (spec §16) — the lobby's actual information. */
  memberList: { gap: theme.spacing[2] },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: chipRowGap,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
    minHeight: touchTarget.min,
  },
  memberNameRow: { alignItems: 'flex-start', gap: chipRowGap, flex: 1 },
  // Was body at 600. Regular: the avatar, the badge and the status chip carry
  // the row's hierarchy; the name does not need a face of its own.
  memberName: { flexShrink: 1 },
  sectionTitle: { flex: 1 },
}))
