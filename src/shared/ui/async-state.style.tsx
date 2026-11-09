import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  stitchContainer: { gap: spacing[1], paddingHorizontal: spacing[4] },
  stitchBody: { maxWidth: 280, marginBottom: spacing[5] },
  illustration: { marginBottom: spacing[2] },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  staleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.status.warningSoft,
  },
  staleLabel: { flex: 1 },
}))
