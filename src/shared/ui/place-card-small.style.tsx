import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  surface: { padding: theme.spacing[2], borderRadius: 16, borderWidth: 1, borderColor: theme.border.hairline, shadowOpacity: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  unavailablePhoto: { opacity: 0.5 },
  photo: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.surface.container },
  unavailableName: { textDecorationLine: 'line-through' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  removableSurface: { overflow: 'visible' },
  remove: { position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.border.hairline, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.high },
  name: { paddingVertical: 2 },
  withAction: { paddingRight: 22 + theme.spacing[3] },
  featureOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
}))
