import { StyleSheet } from 'react-native-unistyles'

import { fill, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.status.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },

  /** Total, time and the over-budget note lead the screen as one card. */
  summaryCard: { marginBottom: theme.spacing[5], gap: theme.spacing[3] },
  summaryTotalRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[4] },
  summaryTotalValue: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  summaryDivider: { height: 1, backgroundColor: theme.border.hairline },
  summaryTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[4] },
  summaryAmountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: theme.spacing[1] },
  summarySecondary: { flexShrink: 1, textAlign: 'right' },
  summaryOverBudget: { marginTop: 2 },

  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[2],
    paddingLeft: theme.spacing[4],
  },
  legLine: { width: 2, height: 22, backgroundColor: theme.accent.soft },
  legRail: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  stopCard: { overflow: 'hidden', marginBottom: theme.spacing[3] },
  /** The photo carries the order, the lock and the status; the name sits under it so it never depends on the picture for contrast. */
  stopHero: { height: 160, justifyContent: 'flex-start' },
  stopImage: { ...fill },
  stopHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[2],
    padding: theme.spacing[3],
  },
  stopOrderBadge: {
    backgroundColor: theme.night.surface,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  stopBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopInfo: { padding: theme.spacing[4], gap: 2 },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
  },
  lockBtnOn: { backgroundColor: theme.accent.primary },
  lockBtnOff: { backgroundColor: theme.surface.card },
  stopArea: { marginTop: 2 },
  stopPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing[2] },
  stopActions: { flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[3] },
  detailBtn: {
    flex: 1,
    height: touchTarget.min,
    borderRadius: theme.radius.button,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionBtn: {
    flex: 1,
    height: touchTarget.min,
    borderRadius: theme.radius.button,
    backgroundColor: theme.surface.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  goBtn: { alignSelf: 'stretch' },
  /** #251 — where the start CTA would be when this caller cannot start the date. */
  startNotice: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  startNoticeLabel: { textAlign: 'center' },
  startError: { textAlign: 'center', marginTop: theme.spacing[2] },
  secondaryRow: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[2] },

  /** Stale and superseded notices: a soft warning card, the words and the icon both say it. */
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[3],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.status.warningSoft,
  },
  staleText: { flex: 1 },

  /**
   * Locked / required / completed must be told apart without colour (spec §20):
   * a locked stop carries a left edge, a padlock and the word, not just a tint.
   */
  stopCardLocked: { borderLeftWidth: 4, borderLeftColor: theme.accent.primary },
  // A finished stop steps back by surface, not by fading (#382): opacity took
  // its text.secondary lines under AA. The "Xong" chip says it.
  stopCardCompleted: { backgroundColor: theme.surface.canvas, shadowOpacity: 0, elevation: 0 },
}))
