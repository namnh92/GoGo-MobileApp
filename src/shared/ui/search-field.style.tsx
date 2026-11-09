import { StyleSheet } from 'react-native-unistyles'

/**
 * Solid `surface.card` with a hairline (#381) — it used to be the 78 % white
 * `glassFx.chip` wash, and glass is only for the tab bar and bottom bars.
 * 48pt tall, above the 44pt minimum.
 */
export const styles = StyleSheet.create(theme => ({
  discoveryShell: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 12, backgroundColor: theme.surface.high, borderRadius: 12 },
  discoveryInput: { ...theme.type.introBody, flex: 1, minWidth: 0, minHeight: 48, color: theme.text.primary },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...theme.type.body,
    minHeight: 48,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    paddingHorizontal: theme.spacing[4],
    color: theme.text.primary,
  },
}))
