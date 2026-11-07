import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing[2] + 2,
    paddingVertical: 4,
    borderRadius: theme.radius.compact,
    maxWidth: '100%',
    backgroundColor: theme.redesign.container,
  },
  chipGogo: { backgroundColor: theme.status.infoSoft, borderColor: theme.status.infoSoft },
}))
