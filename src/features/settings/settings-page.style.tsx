import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  header: { backgroundColor: theme.surface.canvas, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing[4], gap: theme.spacing[2], minHeight: 64 },
  back: { width: 44, height: 44, borderWidth: 0, backgroundColor: 'transparent' },
  footer: { borderTopWidth: 0, left: theme.spacing[4], right: theme.spacing[4], borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing[1], paddingTop: theme.spacing[1], paddingBottom: theme.spacing[1] },
  title: { flex: 1 },
  content: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[6] },
  version: { textAlign: 'center', marginVertical: theme.spacing[5] },
}))
