import { StyleSheet } from 'react-native-unistyles'

/** `space-5` gutter and between messages (design `ScreenConversation`). */
export const styles = StyleSheet.create(theme => ({
  thread: { paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[4] },
  loading: { padding: theme.spacing[4], gap: theme.spacing[5] },
  loadingQuestion: { alignSelf: 'flex-end', width: '82%' },
  loadingAnswer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
  loadingCopy: { flex: 1, padding: theme.spacing[4], gap: theme.spacing[3], borderRadius: theme.radius.card, backgroundColor: theme.surface.card },
  turn: { paddingVertical: theme.spacing[5] / 2, gap: theme.spacing[3] },
  footer: { paddingTop: theme.spacing[3] },
  older: { paddingVertical: theme.spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingHorizontal: theme.spacing[5] },
}))
