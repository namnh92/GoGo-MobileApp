import { StyleSheet } from 'react-native'
import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row' },
  avatarWrap: {
    marginLeft: -12,
    borderWidth: 2,
    borderColor: neutral[50],
    borderRadius: 30,
  },
  morePeople: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: neutral[100],
    borderStyle: 'dashed',
    borderColor: neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePeopleLabel: { ...type.body, fontWeight: '700', color: neutral[500] },
  joined: { ...type.bodySmall, color: neutral[500], marginTop: spacing[3] },
  couplePair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  emptySeat: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: neutral[100],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, color: neutral[900], textAlign: 'center' },
  body: { ...type.body, color: neutral[500], textAlign: 'center', marginTop: spacing[2], marginBottom: spacing[6] },
  error: { ...type.bodySmall, color: brand.red, textAlign: 'center', marginTop: spacing[3] },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center', marginTop: spacing[3], paddingHorizontal: spacing[5] },
  chipsCard: {
    padding: spacing[4],
    marginBottom: spacing[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    backgroundColor: neutral[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  chipLabel: { ...type.label, color: neutral[500] },
  codeCard: { padding: spacing[5], marginBottom: spacing[4] },
  codeCaption: { ...type.caption, color: neutral[500], marginBottom: spacing[2] },
  inviteNote: { ...type.bodySmall, color: neutral[500], marginBottom: spacing[3] },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  codeSkeleton: { flex: 1, height: spacing[6] },
  /**
   * The server issues an opaque token, not a five-character code people read
   * aloud — 22 characters is normal. Display size with wide letter-spacing wrapped
   * it onto a second line and pushed the copy button outside the card, so the
   * code takes the room it needs and the button keeps its own.
   */
  // No monospace face: the spec's `mono` style was dropped with the Inter
  // embed (owner, 2026-09-24), and a `fontFamily` outside tokens.ts is now a
  // test failure. #295 moves this to `body` with `adjustsFontSizeToFit`.
  code: {
    ...type.title2,
    flex: 1,
    color: neutral[900],
    letterSpacing: 0.5,
  },
  copyBtn: { flexShrink: 0 },
  copyBtnDone: { backgroundColor: brand.mintSoft, borderColor: brand.mint },
  noApp: {
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  noAppDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.mint },
  noAppLabel: { ...type.bodySmall, color: neutral[500] },

  /** Per-member status (spec §16) — the lobby's actual information. */
  memberList: { gap: spacing[2], marginBottom: spacing[5] },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.compact,
    minHeight: touchTarget.min,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  memberName: { ...type.body, fontWeight: '600', color: neutral[900], flexShrink: 1 },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: brand.coralSoft,
  },
  hostBadgeLabel: { ...type.caption, fontWeight: '700', color: brand.coral },
  guestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: brand.lavenderSoft,
  },
  guestBadgeLabel: { ...type.caption, fontWeight: '700', color: brand.lavender },
  constraintsCard: { padding: spacing[4], marginBottom: spacing[4], gap: spacing[2] },
  constraintsTitle: { ...type.caption, color: neutral[500], fontWeight: '700' },
  constraintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  sectionTitle: { ...type.title2, color: neutral[900], marginBottom: spacing[3] },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: neutral[100],
    overflow: 'hidden',
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  progressFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 3 },
})
