import { StyleSheet } from 'react-native-unistyles'
import { colors, glassFx, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    gap: spacing[4],
  },
  visual: {
    width: '100%',
    height: 180,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  chipCoral: {
    backgroundColor: theme.accent.primary,
  },
  chipGlass: {
    backgroundColor: glassFx.cardWash,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  emoji: {
    marginTop: spacing[2],
  },
  title: {
    textAlign: 'center',
  },
  slideBody: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
}))
