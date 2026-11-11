import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  title: { marginTop: spacing[2] },
  body: { marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  error: { marginTop: spacing[4] },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min + 16,
    padding: spacing[3],
    marginBottom: spacing[5],
    borderRadius: radius.card,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  prefillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  prefillLabel: { flex: 1 },
}))
