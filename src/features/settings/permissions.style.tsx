import { StyleSheet } from 'react-native-unistyles'
import { shadows, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  intro: { padding: spacing[4], gap: spacing[3], borderRadius: 12, ...shadows.subtle },
  introRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  introText: { flex: 1, gap: spacing[2] },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.status.infoSoft, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing[2] },
  deviceCard: { borderRadius: 12, overflow: 'hidden', ...shadows.subtle },
  systemSectionTitle: { marginHorizontal: spacing[1], textTransform: 'none' },
  sectionTitle: { marginHorizontal: spacing[1], textTransform: 'uppercase', letterSpacing: 1 },
  signInCard: { padding: spacing[4], gap: spacing[3], shadowOpacity: 0, elevation: 0, borderRadius: 0 },
}))
