import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  countPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: theme.status.successSoft,
    marginTop: spacing[2],
  },
  title: { marginTop: spacing[2] },
  body: { marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  // A pill, as in the draft; the selected one also carries a check glyph, so
  // selection is never colour alone.
  option: {
    minHeight: touchTarget.min + 8,
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderWidth: 1,
  },
  optionIdle: { backgroundColor: theme.surface.card, borderColor: theme.border.hairline },
  optionActive: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
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
