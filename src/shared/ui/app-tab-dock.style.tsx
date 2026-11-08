import { StyleSheet } from 'react-native-unistyles'
import { TAB_BAR_HEIGHT } from './bottom-bar-inset'
import { touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  tabs: { height: TAB_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[1] / 2 },
  activeDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: theme.radius.pill, backgroundColor: theme.accent.primary },
}))
