import { StyleSheet } from 'react-native-unistyles'
import { fill, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  hero: {
    marginHorizontal: spacing[5],
    height: 300,
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: theme.surface.subtle,
  },
  heroScrim: { ...fill, backgroundColor: overlay.scrim },
  heroBadge: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    backgroundColor: theme.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  heroBottom: { position: 'absolute', bottom: spacing[4], left: spacing[4], right: spacing[4] },
  heroVotes: { marginTop: 4 },
  heroMeta: { marginTop: spacing[2] },
  reasonCard: { marginHorizontal: spacing[5], marginTop: spacing[4], padding: spacing[5] },
  reasonTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  reasonLabel: { flex: 1 },
  staleWarning: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
  },
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
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  runnerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runnerAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
  },
}))
