// Canonical style/setting/spending taxonomy keys (SRS FR-PREF-001/002).
// Single source shared by the create flow, search filters and (later) the
// suggestion engine; display labels resolve via the i18n tagLabels map.
export const STYLE_TAGS = [
  'Romantic',
  'Chill',
  'Creative',
  'Playful',
  'Night vibe',
  'Indoor',
  'Outdoor',
  'Quiet',
  'Budget',
  'Fancy',
  'View',
] as const

export type StyleTag = (typeof STYLE_TAGS)[number]
