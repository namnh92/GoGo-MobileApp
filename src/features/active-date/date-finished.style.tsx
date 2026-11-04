import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  root: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  scroll: { alignSelf: 'stretch' },
  // Centred while it fits, scrollable once it does not.
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: { marginTop: spacing[3], textAlign: 'center' },
  body: { marginTop: spacing[2], marginBottom: spacing[5], textAlign: 'center' },
  statsCard: { alignSelf: 'stretch', gap: spacing[3], marginBottom: spacing[5] },
  statsRow: { flexDirection: 'row', gap: spacing[3] },
  statTile: {
    flex: 1,
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  sectionHeader: { alignSelf: 'stretch', paddingHorizontal: spacing[1], marginBottom: spacing[2] },
  card: { alignSelf: 'stretch', padding: spacing[4], marginBottom: spacing[5] },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  stopMark: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarkDone: { backgroundColor: theme.status.successSoft },
  stopRating: { marginTop: 2 },
  connector: { height: 16, width: 2, backgroundColor: theme.border.hairline, marginLeft: 13, marginVertical: 2 },
  // #269 — the room is still open. Says so, and offers the way to close it.
  closing: { alignSelf: 'stretch', gap: spacing[3], marginBottom: spacing[4] },
  closingNote: { textAlign: 'center' },
  closingFailed: { textAlign: 'center' },
  cta: { alignSelf: 'stretch' },
}))
