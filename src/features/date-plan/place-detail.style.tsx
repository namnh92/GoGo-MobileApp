import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

/** The hero sits inside the page margin, as the Stitch draft draws it. */
export const GALLERY_MARGIN = spacing[4]
const GALLERY_HEIGHT = 224
/** No photo: a short placeholder, not a tall empty frame. */
const GALLERY_EMPTY_HEIGHT = 112

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
  galleryEmpty: { height: GALLERY_EMPTY_HEIGHT },
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
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[4] },
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
  updatedRow: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  updated: { flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
  // Directions is the quiet action inside the address row.
  dirBtn: {
    alignSelf: 'flex-start',
    minHeight: touchTarget.min,
    marginTop: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.button,
    backgroundColor: theme.accent.soft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  /** Pressed is a colour change only (#382). */
  dirBtnPressed: { backgroundColor: theme.surface.subtle },

  // --- trust ---------------------------------------------------------------
  attribution: { marginTop: spacing[2] },
  trustRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[2] },
  reportDisabled: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.button,
    backgroundColor: theme.surface.subtle,
  },

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
  mapCard: { ...card, marginTop: spacing[6], overflow: 'hidden' },
  mapPreview: { height: 140 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { textAlign: 'center' },

  // --- sticky action -------------------------------------------------------
  // Position, gutter, glass and hairline are `GlassBar`'s (#296). One bar, as drawn.
  addBtn: { height: touchTarget.min + 8 },
  }
})
