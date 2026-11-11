import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { gap: theme.spacing[4], paddingBottom: theme.spacing[5] },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  note: { minHeight: 100, padding: theme.spacing[3], color: theme.text.primary, backgroundColor: theme.surface.subtle, borderRadius: theme.radius.compact },
}))
