import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from './tokens'

export const styles = StyleSheet.create({
  fields: { gap: spacing[6], marginBottom: spacing[6] },
  stepper: { borderRadius: radius.hero, padding: spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modes: { gap: spacing[3] },
})
