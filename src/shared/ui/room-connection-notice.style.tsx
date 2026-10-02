import { StyleSheet } from 'react-native-unistyles'

/**
 * Same footprint as the stale bar it shares a slot with (`async-state.style`),
 * so switching between them does not move the screen. Solid fills only: the
 * notice carries text, and contrast must not depend on a blurred layer.
 */
export const styles = StyleSheet.create(theme => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.compact,
  },
  polling: { backgroundColor: theme.status.infoSoft },
  connecting: { backgroundColor: theme.surface.subtle },
  label: { flex: 1, flexShrink: 1 },
}))
