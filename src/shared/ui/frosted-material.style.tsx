import { StyleSheet } from 'react-native-unistyles'
import { fill } from './tokens'
export const styles = StyleSheet.create(theme => ({
  fill: { ...fill },
  nativeFill: { flex: 1 },
  bubble: { backgroundColor: theme.redesign.bubble },
  panel: { backgroundColor: theme.redesign.panel },
  header: { backgroundColor: theme.redesign.header },
  solid: { backgroundColor: theme.redesign.card },
  solidHeader: { backgroundColor: theme.redesign.canvas },
}))
