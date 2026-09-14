import { StyleSheet } from 'react-native'

import { colors, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  sectionTitle: { ...type.title2, color: neutral[900], marginTop: spacing[5] },
  signInCard: { padding: spacing[4], marginTop: spacing[3], gap: spacing[3] },
  body: { ...type.body, color: neutral[700] },
})
