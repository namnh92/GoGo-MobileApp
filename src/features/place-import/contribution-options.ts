/** Stitch order, mapped only to existing GET /v1/taxonomies keys (2026-11-07).
 * Missing source options are recorded in PR-518-place-wizard.md, never guessed.
 */
export const purposeOptions = ['couple', 'work_reading', 'group', 'family'] as const
export const vibeOptions = ['festive'] as const
// No checkin_tag key currently represents the three Stitch rating chips.
export const ratingOptions: readonly string[] = []
