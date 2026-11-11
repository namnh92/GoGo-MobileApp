import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  body: { marginTop: spacing[2] },
  title: {
    marginTop: spacing[2],
  },
  stepper: {
    borderRadius: radius.hero,
    padding: spacing[5],
    marginTop: spacing[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: { backgroundColor: theme.accent.primary },
  sectionTitle: {
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },

  /**
   * Two alternatives, each a card that says what it means for the room's
   * prices. The selection is a tint, a ring and a check together.
   */
  modes: { gap: spacing[3] },
  mode: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.card,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    ...theme.shadows.card,
  },
  modeActive: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
  modeBody: { flex: 1 },
  modeHelp: { marginTop: spacing[1] },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: theme.accent.primary },
}))
