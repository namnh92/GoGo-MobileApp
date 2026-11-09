import { StyleSheet } from 'react-native-unistyles'
import { tabRootSpacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  createAction: { paddingHorizontal: theme.spacing[5], paddingBottom: tabRootSpacing.headingContent },
  planActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[2] },
  card: { marginBottom: theme.spacing[3] },
}))
