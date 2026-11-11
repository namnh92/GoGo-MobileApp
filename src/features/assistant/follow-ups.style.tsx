import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap } from '@/shared/ui/tokens'


/** Chips: 44pt tall (the touch target), 4pt apart (owner 2026-11-10), wrapping. */
export const styles = StyleSheet.create(theme => ({
  group: { gap: theme.spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
}))
