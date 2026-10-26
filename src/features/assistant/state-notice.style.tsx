import { StyleSheet } from 'react-native-unistyles'

/** Design system `StateNotice`: a status tile, a short statement, next steps. */
export const styles = StyleSheet.create(theme => ({
  notice: { gap: theme.spacing[3] },
  inline: {
    backgroundColor: theme.surface.card,
    borderRadius: theme.radius.card,
    padding: theme.spacing[4],
    ...theme.shadows.card,
  },
  screen: { alignItems: 'center', paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[7] },
  tile: { width: 40, height: 40, borderRadius: theme.radius.compact, alignItems: 'center', justifyContent: 'center' },
  tileInfo: { backgroundColor: theme.status.infoSoft },
  tileDanger: { backgroundColor: theme.status.dangerSoft },
  tileSuccess: { backgroundColor: theme.status.successSoft },
  textInline: { gap: theme.spacing[1] },
  textScreen: { gap: theme.spacing[2], alignItems: 'center' },
  centered: { textAlign: 'center' },
  actions: { gap: theme.spacing[2], alignSelf: 'stretch' },
}))
