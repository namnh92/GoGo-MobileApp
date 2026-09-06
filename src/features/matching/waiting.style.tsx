import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6] },
  eyes: { fontSize: 56, marginBottom: spacing[5] },
  title: { ...type.display, color: neutral[900], textAlign: 'center' },
  body: { ...type.body, color: neutral[500], marginTop: spacing[3], textAlign: 'center' },

  /** How far the room is, in one line and one bar (spec §18). */
  progress: { alignSelf: 'stretch', marginTop: spacing[6], marginBottom: spacing[5], gap: spacing[2] },
  progressLabel: { ...type.label, color: neutral[700], textAlign: 'center' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: neutral[100], overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 3 },

  card: { alignSelf: 'stretch', padding: spacing[5], marginBottom: spacing[6], gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  name: { ...type.body, fontWeight: '600', color: neutral[900], flexShrink: 1 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneLabel: { ...type.label, color: brand.mint },
  notStarted: { ...type.bodySmall, color: neutral[500] },

  actions: { alignSelf: 'stretch', gap: spacing[2] },
  partialWarning: { ...type.caption, color: brand.amber, textAlign: 'center', marginTop: spacing[2] },
  retryNote: {
    ...type.bodySmall,
    color: brand.amber,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  reminded: {
    minHeight: touchTarget.min,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
