import { StyleSheet } from 'react-native-unistyles'
import { touchTarget } from './tokens'

export const styles = StyleSheet.create({
  toggle: { alignSelf: 'center', minHeight: touchTarget.min, minWidth: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
})
