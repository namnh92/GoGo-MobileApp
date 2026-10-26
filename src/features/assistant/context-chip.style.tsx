import { StyleSheet } from 'react-native-unistyles'

/** Design system `ContextChip`: a 32pt card-white pill with a hairline edge. */
export const styles = StyleSheet.create(theme => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 32,
    gap: 6,
    paddingLeft: 10,
    paddingRight: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
  },
  label: { flexShrink: 1 },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  removePressed: { backgroundColor: theme.surface.subtle },
}))
