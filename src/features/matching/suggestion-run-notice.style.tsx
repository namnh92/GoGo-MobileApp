import { StyleSheet } from 'react-native'

import { colors, spacing, type } from '@/shared/ui/tokens'

const { brand } = colors

export const styles = StyleSheet.create({
  actions: { alignSelf: 'stretch', gap: spacing[2] },
  error: { ...type.bodySmall, color: brand.red, textAlign: 'center' },
})
