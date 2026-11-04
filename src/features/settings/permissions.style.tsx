import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing[6], textTransform: 'uppercase', letterSpacing: 1 },
  signInCard: { padding: spacing[4], marginTop: spacing[3], gap: spacing[3] },
})
