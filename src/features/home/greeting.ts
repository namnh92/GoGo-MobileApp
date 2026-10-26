/**
 * Part of the day the Home greeting names (#382). It used to say "evening" at
 * breakfast. Boundaries: morning 05:00–11:59, afternoon 12:00–17:59, evening
 * otherwise — late night reads as "evening", not as an early "morning".
 */
export type DayPart = 'morning' | 'afternoon' | 'evening'

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}
