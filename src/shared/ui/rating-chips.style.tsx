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
    backgroundColor: theme.surface.canvas,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  chipGogo: { backgroundColor: theme.status.infoSoft, borderColor: theme.status.infoSoft },
}))
