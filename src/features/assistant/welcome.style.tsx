import { StyleSheet } from 'react-native-unistyles'

/**
 * Welcome: a soft hero (avatar, greeting, one line) over a labelled stack of
 * the four starting points, full width, one per row.
 */
export const styles = StyleSheet.create(theme => ({
  body: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[4], gap: theme.spacing[3] },
  hero: {
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[6],
    borderRadius: theme.radius.hero,
    backgroundColor: theme.accent.soft,
  },
  centered: { textAlign: 'center' },
  sectionLabel: { paddingTop: theme.spacing[2] },
  list: { gap: theme.spacing[3] },
}))
