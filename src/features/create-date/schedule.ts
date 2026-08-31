/**
 * The wizard picks wall-clock slots ("19:30"); the contract wants ISO-8601
 * instants. A slot that has already passed today means tonight is over, so it
 * resolves to tomorrow — picking "09:00" at 8pm should not create a room that
 * started eleven hours ago.
 */
export function slotToIso(slot: string, now = new Date()): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(slot)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  const candidate = new Date(now)
  candidate.setHours(hours, minutes, 0, 0)
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1)

  return candidate.toISOString()
}

/**
 * End slots after midnight belong to the following day, so an end that lands
 * before the start is rolled forward rather than rejected.
 */
export function endSlotToIso(endSlot: string, startIso: string | null, now = new Date()): string | null {
  const end = slotToIso(endSlot, now)
  if (!end || !startIso) return end

  const endDate = new Date(end)
  const startDate = new Date(startIso)
  if (endDate.getTime() <= startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1)
  }
  return endDate.toISOString()
}
