import { StyleSheet } from 'react-native-unistyles'
import { spacing, radius } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  container: { flexGrow: 1, paddingTop: spacing[6], paddingHorizontal: spacing[4] },
  expiredCard: { backgroundColor: theme.surface.canvas, shadowOpacity: 0, alignItems: 'center', gap: spacing[3] },
  brokenCard: { padding: spacing[6], borderRadius: radius.compact, alignItems: 'center', gap: spacing[3] },
  hero: { width: 112, height: 112, borderRadius: 56, backgroundColor: theme.redesign.container, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  heroInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.redesign.low, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginBottom: spacing[3] },
  guidance: { width: '100%', gap: spacing[2], marginBottom: spacing[3] },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[3], backgroundColor: theme.redesign.low, borderRadius: radius.compact },
  tipText: { flex: 1 },
  actions: { width: '100%', gap: spacing[2], marginTop: spacing[4] },
}))
