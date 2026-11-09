import { StyleSheet } from 'react-native-unistyles'

import { TAB_BAR_HEIGHT } from '@/shared/ui/bottom-bar-inset'

export const styles = StyleSheet.create(theme => ({
  canvas: { backgroundColor: theme.surface.inset },
  list: { paddingHorizontal: 16, paddingTop: 20 },
  subgroup: { marginBottom: 24 },
  wardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  wardCount: { minWidth: 20, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.disabled },
  cards: { gap: 14 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  tabs: { height: TAB_BAR_HEIGHT, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { minWidth: 44, minHeight: 44, alignItems: 'center', gap: 4 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent.primary },
}))
