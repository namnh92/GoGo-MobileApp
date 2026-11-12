import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
})
