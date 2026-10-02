import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  card: {
    borderRadius: radius.hero,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    alignSelf: 'stretch',
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  hint: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing[3], marginTop: spacing[2] },
  badge: {
    backgroundColor: theme.accent.soft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeLabel: { ...type.caption, color: theme.accent.onSoft },
}))
