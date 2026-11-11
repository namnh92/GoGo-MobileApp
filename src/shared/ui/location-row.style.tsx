import { StyleSheet } from 'react-native-unistyles'
import { touchTarget } from './tokens'

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget.min, gap: 4 },
  label: { flexShrink: 1 },
})
