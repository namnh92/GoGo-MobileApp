import { StyleSheet } from 'react-native-unistyles'

/** `space-5` gutter and between messages (design `ScreenConversation`). */
export const styles = StyleSheet.create(theme => ({
  thread: { paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[4] },
  turn: { paddingVertical: theme.spacing[5] / 2, gap: theme.spacing[3] },
  footer: { paddingTop: theme.spacing[3] },
  older: { paddingVertical: theme.spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2], paddingHorizontal: theme.spacing[5] },
}))
