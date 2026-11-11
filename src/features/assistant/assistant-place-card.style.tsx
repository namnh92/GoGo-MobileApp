import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, touchTarget } from '@/shared/ui/tokens'

/**
 * Design system `AssistantEntry variant="card"`: a solid card under the key
 * facts — avatar, title, description, chevron — and the starter questions as
 * accent-soft pills that wrap rather than truncate.
 */
export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[4], gap: theme.spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], minHeight: touchTarget.min },
  headPressed: { backgroundColor: theme.surface.subtle, borderRadius: theme.radius.compact },
  headText: { flex: 1, minWidth: 0 },
  questions: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  question: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.soft,
    maxWidth: '100%',
  },
  questionPressed: { backgroundColor: theme.surface.subtle },
}))
