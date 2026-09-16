import { parseApiDate } from '@/shared/api/view-models'

/**
 * #254 — the plan screen's title is composed from facts: the room's audience
 * and when the plan starts. These helpers own the "when"; the copy lives in
 * the catalogs, so no day, daypart or audience is baked in here.
 */

/** `otherYear` is any other day outside the current year, which then names its year. */
export type PlanRelativeDay = 'today' | 'tomorrow' | 'other' | 'otherYear'

export interface PlanWhen {
  relative: PlanRelativeDay
  /** Zero-padded calendar parts on the device clock; the catalog orders them. */
  day: string
  month: string
  year: string
  time: string
}

const DAY_MS = 86_400_000

/** When the plan starts: its earliest stop, else the room's own schedule. */
export function planStart(
  stops: readonly { arriveAt?: string }[] | undefined,
  room: { constraints?: { startAt?: string }; scheduledDate?: string } | undefined,
): Date | null {
  const arrivals = (stops ?? []).flatMap(stop => {
    const at = parseApiDate(stop.arriveAt)
    return at ? [at.getTime()] : []
  })
  if (arrivals.length > 0) return new Date(Math.min(...arrivals))
  return parseApiDate(room?.constraints?.startAt ?? room?.scheduledDate) ?? null
}

export function planWhen(start: Date, now: Date): PlanWhen {
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  // Rounded, so a 23- or 25-hour day still counts as one day.
  const days = Math.round((midnight(start) - midnight(now)) / DAY_MS)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    relative:
      days === 0 ? 'today' : days === 1 ? 'tomorrow' : start.getFullYear() === now.getFullYear() ? 'other' : 'otherYear',
    day: pad(start.getDate()),
    month: pad(start.getMonth() + 1),
    year: String(start.getFullYear()),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
  }
}
