import { StyleSheet } from 'react-native-unistyles'
import { loadingIndicator, spacing } from './tokens'

export const styles = StyleSheet.create({
  mark: { alignSelf: 'center', flexShrink: 0, ...loadingIndicator.shadow },
  refreshHeader: { alignItems: 'center', paddingVertical: spacing[2] },
})
