import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.compact,
    backgroundColor: theme.status.dangerSoft,
  },
  text: { flexShrink: 1 },
}))
