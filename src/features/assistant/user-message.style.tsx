import { StyleSheet } from 'react-native-unistyles'

/** Design system `UserMessage`: 82 % of the thread at most, a 6pt tail corner bottom-right. */
export const styles = StyleSheet.create(theme => ({
  row: { alignItems: 'flex-end', gap: theme.spacing[1] },
  pressable: { borderRadius: theme.radius.compact, maxWidth: '82%' },
  pressablePressed: { backgroundColor: theme.surface.card },
  bubble: {
    maxWidth: '82%',
    alignSelf: 'flex-end',
    backgroundColor: theme.accent.primary,
    borderRadius: theme.radius.card,
    borderBottomRightRadius: 6,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[1],
  },
  bubbleFailed: { backgroundColor: theme.surface.subtle, maxWidth: '100%' },
  photos: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  metaText: { textAlign: 'right' },
}))
