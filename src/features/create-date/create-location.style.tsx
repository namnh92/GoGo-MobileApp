import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  rowBody: { flex: 1 },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { marginTop: spacing[4], marginBottom: spacing[3] },
  distanceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[3] },
  distanceTitle: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  locationFallback: {
    marginTop: spacing[2],
  },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[3] },
}))
