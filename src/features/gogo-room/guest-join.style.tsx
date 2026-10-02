import { StyleSheet } from 'react-native-unistyles'
import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  badge: {
    backgroundColor: theme.accent.soft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[4],
  },
  title: {
    textAlign: 'center',
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  details: { borderRadius: radius.hero, padding: spacing[5], marginBottom: spacing[6] },
  detailsTitle: { marginBottom: spacing[3] },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  noAccount: { textAlign: 'center' },
  nameInput: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  error: {
    textAlign: 'center',
    marginBottom: spacing[4],
  },
}))
