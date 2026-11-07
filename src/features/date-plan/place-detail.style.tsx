import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

/** The hero sits inside the page margin, as the Stitch draft draws it. */
export const GALLERY_MARGIN = spacing[4]
/** The same hero height with or without photos. */
const GALLERY_HEIGHT = 260
const MAP_HEIGHT = 160

export const styles = StyleSheet.create(theme => {
  /** The white, hairline-edged card the Stitch draft stacks on the canvas. */
  const card = {
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    borderRadius: radius.card,
    ...theme.shadows.card,
  } as const
  return {
  // --- header bar ----------------------------------------------------------
  header: {
    backgroundColor: theme.surface.canvas,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.hairline,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    gap: spacing[1],
  },
  headerBtn: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1 },

  // --- gallery -------------------------------------------------------------
  gallery: {
    height: GALLERY_HEIGHT,
    marginHorizontal: GALLERY_MARGIN,
    marginTop: spacing[3],
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: theme.surface.subtle,
  },
  emptyCaptionWrap: { position: 'absolute', left: 0, right: 0, bottom: spacing[4], alignItems: 'center' },
  emptyCaption: {
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.card,
  },
  galleryPage: { height: GALLERY_HEIGHT },
  imageScrim: { ...fill, backgroundColor: overlay.scrimLight },
  galleryDots: {
    position: 'absolute',
    bottom: spacing[3],
    left: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[2],
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: overlay.scrimStrong,
  },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.onDark.wash },
  galleryDotActive: { width: 18, backgroundColor: theme.onDark.strong },
  galleryCount: {
    position: 'absolute',
    right: spacing[3],
    bottom: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: overlay.scrimStrong,
  },

  // --- title block ---------------------------------------------------------
  body: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[5] },
  // The body already carries the side padding the bar would otherwise add.
  sheetNotice: { marginHorizontal: 0, marginBottom: spacing[4] },
  meta: { marginTop: 4 },

  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3] },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  openDotOn: { backgroundColor: theme.status.success },
  openDotOff: { backgroundColor: theme.text.tertiary },
  hoursToggle: { marginLeft: spacing[2], textDecorationLine: 'underline' },
  hoursTable: { marginTop: spacing[2], gap: 4, paddingLeft: spacing[4] },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },

  // --- price and ratings ---------------------------------------------------
  facts: { marginTop: spacing[4], gap: spacing[3] },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  priceText: { flexShrink: 1 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  // GoGo's own measure reads as a different source: tinted, never merged.
  ratingChipGogo: { backgroundColor: theme.status.infoSoft, borderColor: theme.status.infoSoft },

  // Breathing room between the facts and the assistant card.
  assistant: { marginTop: spacing[4] },

  // --- info card -----------------------------------------------------------
  infoCard: { ...card, marginTop: spacing[4], paddingHorizontal: spacing[4] },
  // One rhythm for every row: 10pt above and below, 12pt after the icon.
  // Plain text is not a control, so no 44pt minimum.
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10 },
  // Tappable rows are controls: 44pt at least. Pressed is a colour change only (#382).
  infoRowLink: { minHeight: touchTarget.min },
  infoRowPressed: { backgroundColor: theme.surface.subtle },
  infoRowRule: { borderTopWidth: 1, borderTopColor: theme.border.hairline },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBody: { flex: 1, gap: 2 },
  updatedIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  updated: { flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: 2 },

  // --- trust ---------------------------------------------------------------
  attribution: { marginTop: spacing[3], flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[3] },
  attributionLink: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  // --- sections ------------------------------------------------------------
  sectionTitle: { marginTop: spacing[6], marginBottom: spacing[3] },
  suitCard: {
    ...card,
    padding: spacing[4],
    marginTop: spacing[3],
  },
  suitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing[3],
  },
  suitLabel: { flex: 1 },
  suitTrack: { width: 84, height: 6, borderRadius: 3, backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  suitFill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 3 },
  suitValue: { width: 28, textAlign: 'right' },
  // Directly under the info card, the same width; the whole card is the directions control.
  mapCard: { ...card, marginTop: spacing[3], overflow: 'hidden' },
  /** Pressed is a colour change only (#382). */
  mapCardPressed: { backgroundColor: theme.surface.subtle },
  mapPreview: { height: MAP_HEIGHT },
  mapCorner: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.card,
  },
  mapAttribution: { position: 'absolute', left: spacing[3], bottom: spacing[2] },
  // No coordinates: no map, but directions stay one tap away.
  dirCard: {
    ...card,
    marginTop: spacing[3],
    minHeight: touchTarget.min,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reportNotice: { marginBottom: spacing[3] },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { textAlign: 'center' },

  // --- sticky action -------------------------------------------------------
  // Position, gutter, glass and hairline are `GlassBar`'s (#296). One bar, as drawn.
  addBtn: { height: touchTarget.min + 8 },
  }
})
