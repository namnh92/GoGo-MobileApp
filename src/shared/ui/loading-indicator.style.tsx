import { StyleSheet } from 'react-native-unistyles'
import { loadingIndicator } from './tokens'

export const styles = StyleSheet.create({
  mark: { alignSelf: 'center', flexShrink: 0, ...loadingIndicator.shadow },
})
