import { StyleSheet } from 'react-native'
import { colors, radius, spacing, onDark, overlay } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  counter: { fontSize: 13, fontWeight: '700', color: neutral[900] },
  header: { fontSize: 13, color: neutral[500], fontWeight: '500' },
  subheader: { fontSize: 11, color: neutral[300] },
  progressTrack: {
    marginHorizontal: spacing[5],
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral[100],
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  progressFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 2 },
  card: {
    height: 420,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  imageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.scrimMedium },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: overlay.scrimStrong,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  categoryLabel: { color: neutral[0], fontSize: 11, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  overlayLabel: { color: neutral[0], fontSize: 18, fontWeight: '800' },
  areaRow: { position: 'absolute', bottom: 12, left: 12 },
  areaLabel: { color: onDark.strong, fontSize: 12, fontWeight: '500' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: neutral[900] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },
  desc: { fontSize: 13, color: neutral[500], marginTop: spacing[2], lineHeight: 19 },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing[4],
    marginTop: spacing[4],
  },
  actionCol: {
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCaption: { fontSize: 11, color: neutral[300] },
})
