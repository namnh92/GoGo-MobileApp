import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  button: { width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: theme.redesign.low },
  unreadDot: { position: 'absolute', top: spacing[1], right: spacing[1], width: spacing[2], height: spacing[2], borderRadius: radius.pill, backgroundColor: theme.redesign.primaryFill },
}))
