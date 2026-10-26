import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing[6], gap: theme.spacing[3] },
  centered: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: theme.spacing[3] },
}))
