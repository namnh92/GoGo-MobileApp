import { StyleSheet } from 'react-native-unistyles'

import { colors, touchTarget } from '@/shared/ui/tokens'

/** Dashed seat outlines: the line colour, which has no semantic role of its own yet. */
const seatLine = colors.neutral[300]

export const styles = StyleSheet.create(theme => ({
  avatarRow: { flexDirection: 'row' },
  avatarWrap: {
    marginLeft: -12,
    borderWidth: 2,
    borderColor: theme.surface.canvas,
    borderRadius: 30,
  },
  morePeople: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.surface.subtle,
    borderStyle: 'dashed',
    borderColor: seatLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Was body at 700 — not a style on the scale. `label` is the heavier face.
  morePeopleLabel: { ...theme.type.label, color: theme.text.secondary },
  joined: { ...theme.type.bodySmall, color: theme.text.secondary, marginTop: theme.spacing[3] },
  couplePair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[4],
    marginTop: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  emptySeat: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.surface.subtle,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: seatLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...theme.type.display, color: theme.text.primary, textAlign: 'center' },
  body: {
    ...theme.type.body,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[6],
  },
  error: { ...theme.type.bodySmall, color: theme.status.dangerText, textAlign: 'center', marginTop: theme.spacing[3] },
  notice: {
    ...theme.type.bodySmall,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
  },

  /** Info cards (#293 §3): padded `Card`, caption heading, body content. */
  codeCard: { marginBottom: theme.spacing[4] },
  cardHeading: { marginBottom: theme.spacing[2] },
  inviteNote: { ...theme.type.bodySmall, color: theme.text.secondary, marginBottom: theme.spacing[3] },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  codeSkeleton: { flex: 1, height: theme.spacing[6] },
  /**
   * The server issues an opaque token, not a five-character code people read
   * aloud — 22 characters is normal. One line that shrinks to fit keeps the
   * copy button inside the card at 375pt; the text stays selectable.
   */
  code: { flex: 1, letterSpacing: 0.5 },
  copyBtn: { flexShrink: 0 },
  copyBtnDone: { backgroundColor: theme.status.successSoft, borderColor: theme.status.success },
  noApp: {
    marginTop: theme.spacing[2],
    paddingVertical: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  noAppDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.status.success },
  noAppLabel: { ...theme.type.bodySmall, color: theme.text.secondary },

  /** Per-member status (spec §16) — the lobby's actual information. */
  memberList: { gap: theme.spacing[2], marginBottom: theme.spacing[5] },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    borderRadius: theme.radius.compact,
    minHeight: touchTarget.min,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flex: 1 },
  // Was body at 600. Regular: the avatar, the badge and the status chip carry
  // the row's hierarchy; the name does not need a face of its own.
  memberName: { ...theme.type.body, color: theme.text.primary, flexShrink: 1 },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.soft,
  },
  hostBadgeLabel: { ...theme.type.caption, color: theme.accent.onSoft },
  guestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.status.infoSoft,
  },
  guestBadgeLabel: { ...theme.type.caption, color: theme.status.infoText },
  constraintsCard: { marginBottom: theme.spacing[4], gap: theme.spacing[2] },
  constraintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  sectionTitle: { ...theme.type.title2, color: theme.text.primary, marginBottom: theme.spacing[3] },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.surface.subtle,
    overflow: 'hidden',
    marginTop: theme.spacing[3],
    marginBottom: theme.spacing[2],
  },
  progressFill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 3 },
}))
