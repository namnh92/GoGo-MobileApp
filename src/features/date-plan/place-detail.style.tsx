import { StyleSheet } from 'react-native'

import { colors, glassFx, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  // --- gallery -------------------------------------------------------------
  gallery: { height: 280 },
  galleryPage: { height: 280 },
  imageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.scrimLight },
  galleryDots: {
    position: 'absolute',
    bottom: spacing[7],
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: glassFx.badge },
  galleryDotActive: { width: 18, backgroundColor: neutral[0] },
  galleryCount: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[7],
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: overlay.scrimStrong,
  },
  galleryCountLabel: { ...type.caption, color: neutral[0], fontWeight: '700' },

  backBtn: {
    position: 'absolute',
    left: spacing[4],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: glassFx.solid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backInline: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },

  sheet: {
    marginTop: -28,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: glassFx.sheet,
  },
  body: { paddingHorizontal: spacing[5], paddingTop: spacing[7], paddingBottom: spacing[5] },

  // --- identity ------------------------------------------------------------
  // Saving belongs to the card, not to the action bar: it acts on the place
  // being read, while the bar below is about what to do next.
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  identityText: { flex: 1 },
  name: { ...type.display, color: neutral[900] },
  meta: { ...type.body, color: neutral[500], marginTop: 4 },

  // --- fact strip ----------------------------------------------------------
  factStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing[4],
    borderRadius: radius.card,
    backgroundColor: neutral[50],
    paddingVertical: spacing[3],
  },
  fact: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing[2] },
  factDivider: { width: 1, backgroundColor: neutral[100], marginVertical: spacing[1] },
  factValue: { ...type.title2, color: neutral[900], textAlign: 'center' },
  factValueMuted: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
  factCaption: { ...type.caption, color: neutral[500], textAlign: 'center' },

  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3] },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  open: { ...type.label, color: brand.mint },
  closed: { ...type.label, color: neutral[500] },
  hoursToggle: { ...type.bodySmall, color: brand.coral, marginLeft: 'auto' },
  hoursTable: { marginTop: spacing[2], gap: 4, paddingLeft: spacing[4] },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursDay: { ...type.bodySmall, color: neutral[500] },
  hoursValue: { ...type.bodySmall, color: neutral[900] },
  hoursToday: { fontWeight: '700' },

  // --- address + map -------------------------------------------------------
  addressCard: {
    marginTop: spacing[4],
    backgroundColor: neutral[50],
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  mapPreview: { height: 140 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4] },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.compact,
    backgroundColor: brand.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: { ...type.bodySmall, color: neutral[700], flex: 1 },

  // --- sections ------------------------------------------------------------
  sectionTitle: { ...type.title2, color: neutral[900], marginTop: spacing[6], marginBottom: spacing[3] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },

  // --- ratings -------------------------------------------------------------
  ratingCards: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  ratingCard: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: neutral[50],
    padding: spacing[4],
    gap: 2,
    minHeight: 96,
    justifyContent: 'center',
  },
  ratingSource: { ...type.caption, color: neutral[500], fontWeight: '700' },
  ratingValue: { ...type.title1, color: neutral[900] },
  ratingCount: { ...type.caption, color: neutral[500] },
  ratingEmpty: { ...type.bodySmall, color: neutral[500], lineHeight: 18 },

  // --- suitability ---------------------------------------------------------
  suitCard: {
    backgroundColor: neutral[50],
    borderRadius: radius.card,
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
  suitLabel: { ...type.bodySmall, color: neutral[700], flex: 1 },
  suitTrack: { width: 84, height: 6, borderRadius: 3, backgroundColor: neutral[100], overflow: 'hidden' },
  suitFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 3 },
  suitValue: { ...type.label, color: neutral[900], width: 28, textAlign: 'right' },

  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  factCard: {
    width: '48%',
    borderRadius: radius.compact,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  factLabel: { ...type.bodySmall, color: neutral[700], flexShrink: 1 },

  // --- trust ---------------------------------------------------------------
  attribution: { ...type.caption, color: neutral[500], marginTop: spacing[2] },
  trustCard: {
    marginTop: spacing[6],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: neutral[100],
    padding: spacing[4],
    gap: spacing[2],
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  updated: { ...type.bodySmall, color: neutral[500], flex: 1 },
  report: { ...type.label, color: neutral[500], textDecorationLine: 'underline' },
  reportDisabled: { ...type.label, color: neutral[300] },
  reportHint: { ...type.caption, color: neutral[500] },

  // --- sticky actions ------------------------------------------------------
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: glassFx.bar,
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    // Stacked, not split: each CTA gets the full width, so a Vietnamese label
    // is never the reason a button has to shrink.
    gap: spacing[3],
  },
  saveBtn: {
    width: touchTarget.min + 8,
    height: touchTarget.min + 8,
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: neutral[100],
    backgroundColor: glassFx.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnActive: { borderColor: brand.coral, backgroundColor: brand.coralSoft },
  addBtn: { height: touchTarget.min + 8 },
  dirBtn: {
    height: touchTarget.min + 8,
    borderRadius: radius.compact,
    // coralDeep, not coral: white on #D84F4A is 4.09:1, under AA for this
    // label. This button paints its own background rather than going through
    // PrimaryBtn, so it was missed when the CTA gradient was fixed (#141).
    backgroundColor: brand.coralDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dirLabel: { ...type.body, fontWeight: '700', color: neutral[0] },
})
