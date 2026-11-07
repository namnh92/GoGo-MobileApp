import { StyleSheet } from 'react-native-unistyles'

import { TAB_BAR_HEIGHT } from '@/shared/ui/bottom-bar-inset'

export const styles = StyleSheet.create(theme => ({
  canvas: { backgroundColor: theme.redesign.savedCanvas },
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.redesign.savedLine },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.redesign.card, borderWidth: 1, borderColor: theme.redesign.savedLine, alignItems: 'center', justifyContent: 'center' },
  bell: { borderRadius: 22, backgroundColor: theme.redesign.card, borderWidth: 1, borderColor: theme.redesign.savedLine },
  titleBlock: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
  cityCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: theme.redesign.savedLine, backgroundColor: theme.redesign.savedAccentSoft },
  list: { paddingHorizontal: 16, paddingTop: 20 },
  subgroup: { marginBottom: 24 },
  wardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  wardCount: { minWidth: 20, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.redesign.savedCount },
  cards: { gap: 14 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  tabs: { height: TAB_BAR_HEIGHT, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { minWidth: 44, minHeight: 44, alignItems: 'center', gap: 4 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.redesign.primaryFill },
}))
