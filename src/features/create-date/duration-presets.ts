import type { DurationPresetKey } from '@/shared/store/roomStore'

import { addMinutesToSlot } from './schedule'

/**
 * APP-051 (#204). The create-room contract carries `constraint.startAt` and
 * `constraint.endAt` and nothing else — there is no duration field — so a
 * length cannot stand in for a start time. A preset fills in the end once a
 * start exists; the start stays required.
 *
 * A range ("2–3 giờ") ends at its upper bound, so the window GoGo filters
 * opening hours against covers the whole range. "Cả tối" has no fixed end.
 */
export const DURATION_PRESETS: readonly { key: DurationPresetKey; minutes: number | null }[] = [
  { key: 'upTo2h', minutes: 120 },
  { key: 'upTo3h', minutes: 180 },
  { key: 'upTo4h', minutes: 240 },
  { key: 'evening', minutes: null },
]

/** The end a preset implies for a start, or null when it leaves the end open. */
export function presetEnd(startSlot: string, key: DurationPresetKey): string | null {
  const minutes = DURATION_PRESETS.find(preset => preset.key === key)?.minutes ?? null
  return minutes === null ? null : addMinutesToSlot(startSlot, minutes)
}
