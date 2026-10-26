import { StyleSheet } from 'react-native-unistyles'

/** Design system `AssistantEntry variant="row"`: a 64pt list row on a card. */
export const styles = StyleSheet.create(theme => ({
  section: { marginHorizontal: theme.spacing[5], marginBottom: theme.spacing[4] },
  label: { paddingHorizontal: theme.spacing[1], marginBottom: theme.spacing[2] },
  card: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: 64,
    paddingVertical: theme.spacing[3],
    paddingLeft: theme.spacing[4],
    paddingRight: theme.spacing[3],
  },
  rowPressed: { backgroundColor: theme.surface.subtle },
  text: { flex: 1, minWidth: 0 },
}))
