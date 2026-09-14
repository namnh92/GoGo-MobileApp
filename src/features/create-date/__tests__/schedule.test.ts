import { describe, expect, it } from 'vitest'

import { addMinutesToSlot, endSlotToIso, slotToIso } from '../schedule'

// Fixed local reference point: 2026-08-27 20:00 local.
const now = new Date(2026, 7, 27, 20, 0, 0, 0)

describe('slotToIso', () => {
  it('keeps a slot that is still ahead on the same day', () => {
    const iso = slotToIso('21:30', now)
    const parsed = new Date(iso as string)

    expect(parsed.getDate()).toBe(27)
    expect(parsed.getHours()).toBe(21)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('rolls a slot that has already passed to tomorrow', () => {
    // Picking 09:00 at 8pm means tomorrow morning, not this morning.
    const parsed = new Date(slotToIso('09:00', now) as string)

    expect(parsed.getDate()).toBe(28)
    expect(parsed.getHours()).toBe(9)
  })

  it('rejects a malformed slot', () => {
    expect(slotToIso('9:00', now)).toBeNull()
    expect(slotToIso('25:00', now)).toBeNull()
    expect(slotToIso('', now)).toBeNull()
  })
})

describe('endSlotToIso', () => {
  it('keeps an end that is after the start', () => {
    const start = slotToIso('21:00', now) as string
    const end = new Date(endSlotToIso('23:00', start, now) as string)

    expect(end.getDate()).toBe(27)
    expect(end.getHours()).toBe(23)
  })

  it('rolls an after-midnight end to the next day', () => {
    const start = slotToIso('22:00', now) as string
    const end = new Date(endSlotToIso('01:00', start, now) as string)

    expect(end.getTime()).toBeGreaterThan(new Date(start).getTime())
    expect(end.getHours()).toBe(1)
  })

  it('returns the plain slot when there is no start yet', () => {
    expect(endSlotToIso('23:00', null, now)).toBe(slotToIso('23:00', now))
  })
})

describe('addMinutesToSlot (#204)', () => {
  it('moves a slot forward by a length', () => {
    expect(addMinutesToSlot('19:00', 180)).toBe('22:00')
    expect(addMinutesToSlot('19:30', 120)).toBe('21:30')
  })

  it('wraps past midnight, leaving the day to endSlotToIso', () => {
    expect(addMinutesToSlot('23:00', 120)).toBe('01:00')
    expect(addMinutesToSlot('23:30', 30)).toBe('00:00')
    const start = slotToIso('23:00', now) as string
    const end = new Date(endSlotToIso(addMinutesToSlot('23:00', 120) as string, start, now) as string)
    expect(end.getTime() - new Date(start).getTime()).toBe(2 * 3_600_000)
  })

  it('rejects malformed input instead of guessing', () => {
    expect(addMinutesToSlot('9:00', 60)).toBeNull()
    expect(addMinutesToSlot('24:00', 60)).toBeNull()
    expect(addMinutesToSlot('19:00', -30)).toBeNull()
    expect(addMinutesToSlot('19:00', 1.5)).toBeNull()
  })
})
