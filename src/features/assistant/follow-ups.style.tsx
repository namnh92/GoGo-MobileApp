import { StyleSheet } from 'react-native-unistyles'


/** Chips: 44pt tall (the touch target), `space-2` apart, wrapping. */
export const styles = StyleSheet.create(theme => ({
  group: { gap: theme.spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
}))
