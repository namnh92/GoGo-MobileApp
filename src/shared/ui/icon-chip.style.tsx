import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  chip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent.soft, borderWidth: 0 },
  danger: { backgroundColor: theme.status.dangerSoft },
}))
