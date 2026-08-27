/**
 * Check-in tags.
 *
 * `POST /plans/{id}/stops/{stopId}/checkin` takes `tags` as free-form strings,
 * and there is no `checkin_tag` taxonomy kind to resolve labels from
 * (GoGo-BE#171). Sending the localised label would store "Muốn đi lại" for one
 * user and "Would go again" for another, making the data unqueryable — so the
 * key is what travels and the label is display only.
 */
export interface CheckinTag {
  key: string
  emoji: string
}

export const CHECKIN_TAGS: readonly CheckinTag[] = [
  { key: 'would_return', emoji: '❤️' },
  { key: 'easy_conversation', emoji: '💬' },
  { key: 'photogenic', emoji: '📸' },
  { key: 'worth_the_money', emoji: '💸' },
  { key: 'just_okay', emoji: '😐' },
  { key: 'not_a_fit', emoji: '👎' },
] as const
