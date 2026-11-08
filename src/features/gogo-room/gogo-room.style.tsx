import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  avatarRow: { flexDirection: 'row' },
  avatarWrap: {
    marginLeft: -12,
    borderWidth: 2,
    borderColor: theme.surface.canvas,
    borderRadius: 26,
  },
  morePeople: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface.subtle,
    borderStyle: 'dashed',
    borderColor: theme.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joined: { marginTop: theme.spacing[2] },
  hero: { marginBottom: theme.spacing[4], gap: theme.spacing[2], backgroundColor: theme.accent.soft },
  heroBody: { marginBottom: theme.spacing[1] },
  heroPeople: { marginTop: theme.spacing[2] },
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
  couplePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginTop: theme.spacing[2],
  },
  emptySeat: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface.subtle,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    textAlign: 'center',
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[6],
  },
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
  codeSkeleton: { flex: 1, height: theme.spacing[6] },
  /**
   * The server issues an opaque token, not a five-character code people read
   * aloud — 22 characters is normal. One line that shrinks to fit keeps the
   * copy button inside the card at 375pt; the text stays selectable.
   */
  code: { flex: 1, letterSpacing: 0.5, color: theme.accent.primary },
  copyBtn: { flexShrink: 0 },
  copyBtnDone: { backgroundColor: theme.status.successSoft, borderColor: theme.status.success },
  noApp: {
    marginTop: theme.spacing[2],
    paddingVertical: theme.spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },

  /** Per-member status (spec §16) — the lobby's actual information. */
  memberList: { gap: theme.spacing[2] },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.subtle,
    minHeight: touchTarget.min,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flex: 1 },
  // Was body at 600. Regular: the avatar, the badge and the status chip carry
  // the row's hierarchy; the name does not need a face of its own.
  memberName: { flexShrink: 1 },
  sectionTitle: { flex: 1 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.surface.subtle,
    overflow: 'hidden',
    marginBottom: theme.spacing[1],
  },
  progressFill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 3 },
}))
