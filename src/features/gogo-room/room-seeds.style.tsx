import { StyleSheet } from 'react-native-unistyles'
import { touchTarget } from '@/shared/ui/tokens'
export const styles = StyleSheet.create(theme => ({
  card: { gap: theme.spacing[3], marginBottom: theme.spacing[4] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  title: { flex: 1 },
  add: { width: touchTarget.min, height: touchTarget.min },
}))
