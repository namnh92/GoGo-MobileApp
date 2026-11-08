import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  footer: { borderTopWidth: 0, left: theme.spacing[4], right: theme.spacing[4], borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing[1], paddingTop: theme.spacing[1], paddingBottom: theme.spacing[1] },
  content: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[6] },
  version: { textAlign: 'center', marginVertical: theme.spacing[5] },
}))
