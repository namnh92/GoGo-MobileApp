import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  google: { maxWidth: '100%', backgroundColor: theme.redesign.container, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  gogo: { maxWidth: '100%', backgroundColor: theme.redesign.violetSoft, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
}))
