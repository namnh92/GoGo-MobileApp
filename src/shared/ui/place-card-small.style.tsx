import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  surface: { padding: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.border.hairline, shadowOpacity: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unavailablePhoto: { opacity: 0.5 },
  photo: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.redesign.container },
  unavailableName: { textDecorationLine: 'line-through' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  withAction: { paddingRight: 44 },
  featureOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
}))
