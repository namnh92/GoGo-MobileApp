import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: theme.spacing[5], gap: theme.spacing[3] },
  intro: { gap: theme.spacing[1], marginBottom: theme.spacing[2] },
  sectionTitle: { marginTop: theme.spacing[2] },
  stop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], padding: theme.spacing[4] },
  stopText: { flex: 1, minWidth: 0 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3], padding: theme.spacing[4] },
  optionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  optionText: { flex: 1, minWidth: 0, gap: 2 },
  actions: { gap: theme.spacing[2] },
}))
