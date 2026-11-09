import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[2], marginTop: spacing[2], borderRadius: 12, backgroundColor: theme.surface.low },
  thumbnail: { width: 40, height: 40, borderRadius: 8 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  appointment: { gap: spacing[1], marginTop: spacing[2] },
  venue: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  venueText: { flex: 1, minWidth: 0 },
}))
