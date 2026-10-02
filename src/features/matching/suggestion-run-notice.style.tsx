import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  actions: { alignSelf: 'stretch', gap: spacing[2] },
  error: { textAlign: 'center' },
})
