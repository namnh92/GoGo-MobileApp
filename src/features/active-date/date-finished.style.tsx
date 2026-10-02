import { StyleSheet } from 'react-native-unistyles'
import { colors, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  root: {
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  scroll: { alignSelf: 'stretch' },
  // Centred while it fits, scrollable once it does not.
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
  },
  burst: { marginBottom: spacing[4] },
  body: { marginTop: spacing[2], marginBottom: spacing[7], textAlign: 'center' },
  card: { alignSelf: 'stretch', padding: spacing[5], marginBottom: spacing[7] },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  stopRating: { marginTop: 2 },
  stopBill: { ...type.label, color: neutral[500], marginTop: 2 },
  photoStrip: { flexDirection: 'row', gap: 4 },
  photoThumb: { width: 32, height: 32, borderRadius: 8 },
  connector: { height: 16, width: 2, backgroundColor: neutral[100], alignSelf: 'center', marginVertical: 2 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    marginTop: spacing[3],
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stars: { flexDirection: 'row', gap: 2 },
  // #269 — the room is still open. Says so, and offers the way to close it.
  closing: { alignSelf: 'stretch', gap: spacing[3], marginBottom: spacing[4] },
  closingNote: { textAlign: 'center' },
  closingFailed: { textAlign: 'center' },
  cta: { alignSelf: 'stretch' },
})
