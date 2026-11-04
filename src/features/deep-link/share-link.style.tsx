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
  ring: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
    marginBottom: spacing[2],
  },
  core: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDanger: { backgroundColor: theme.status.dangerSoft },
  coreWarning: { backgroundColor: theme.status.warningSoft },
  coreInfo: { backgroundColor: theme.status.infoSoft },
  coreAccent: { backgroundColor: theme.accent.soft },
  hero: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[9],
    gap: spacing[3],
    alignItems: 'center',
  },
  cardActions: { alignSelf: 'stretch', gap: spacing[3], marginTop: spacing[4] },
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
