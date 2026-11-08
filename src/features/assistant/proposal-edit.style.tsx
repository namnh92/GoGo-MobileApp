import { StyleSheet } from 'react-native-unistyles'


export const styles = StyleSheet.create(theme => ({
  body: { gap: theme.spacing[4] },
  field: { gap: theme.spacing[1] },
  input: {
    ...theme.type.body,
    minHeight: 48,
    borderRadius: theme.radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    paddingHorizontal: theme.spacing[4],
    color: theme.text.primary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  actions: { gap: theme.spacing[2] },
}))
