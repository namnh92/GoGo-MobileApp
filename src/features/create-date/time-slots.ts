// 30-minute slots, 08:00 → 23:30 (mock — real slots come from constraints).
export const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  return `${String(h).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
})

/** The evening starts offered as chips; any other time is one tap away in the slot grid. */
export const EVENING_STARTS = ['17:00', '18:00', '19:00', '20:00', '21:00'] as const
