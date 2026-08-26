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

/** Subset for the search filter sheet: excludes keys already covered by the
 *  category group ('Night vibe' ↔ Về đêm) and by the numeric price range
 *  ('Budget'/'Fancy') to avoid duplicate/conflicting filters. */
export const SEARCH_STYLE_TAGS = STYLE_TAGS.filter(
  tag => tag !== 'Night vibe' && tag !== 'Budget' && tag !== 'Fancy',
)
