import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  heroBadgePosition: { position: 'absolute', top: spacing[3], left: spacing[3] },
  intro: { paddingHorizontal: spacing[5], gap: spacing[1], marginBottom: spacing[4] },
  summary: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radius.card,
    backgroundColor: theme.accent.soft,
  },
  hero: { marginHorizontal: spacing[5], borderRadius: radius.hero, overflow: 'hidden' },
  heroPhoto: { aspectRatio: 1.6, backgroundColor: theme.surface.subtle },
  heroBody: { padding: spacing[4], gap: spacing[2] },
  heroAddress: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroAddressText: { flexShrink: 1 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[1] },
  heroMetaText: { flexShrink: 1 },
  section: { marginHorizontal: spacing[5], marginTop: spacing[5] },
  reasonTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  staleWarning: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
  },
  lobbyRow: { paddingHorizontal: spacing[5], marginTop: spacing[4] },
  bar: { gap: spacing[2] },
  runnersUp: { paddingHorizontal: spacing[5], marginTop: spacing[5], gap: spacing[2] },
  runnersUpTitle: { marginBottom: spacing[1] },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    gap: spacing[3],
  },
  runnerName: { flex: 1 },
  waitingHost: { textAlign: 'center', paddingVertical: spacing[3] },
  error: { textAlign: 'center' },

  /** Facts under the hero — price, distance and open state (spec §19). */
  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  runnerRank: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runnerPoints: {
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: theme.accent.soft,
  },
  runnerAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
  },
}))
