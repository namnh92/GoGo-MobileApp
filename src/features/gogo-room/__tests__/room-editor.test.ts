import { describe, expect, it } from 'vitest'
import type { RoomSummary } from '@/shared/api'
import { roomEditorChanges, roomEditorDefaults, roomEditorSchemaFor, validRoomEditorSchedule } from '../room-editor'

const room = {
  id: 'room-1', title: 'Kèo', type: 'group', participantCount: 4,
  constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND',
    startAt: '2026-11-14T12:17:31.123Z', endAt: '2026-11-16T15:43:42.456Z', administrativeArea: null },
} as RoomSummary

describe('full-screen editor preserves its changed-field contract', () => {
  it('keeps a custom multi-day schedule pristine, without normalizing server precision', () => {
    const base = roomEditorDefaults(room)
    expect(Object.values(roomEditorChanges({ ...base }, base, false)).some(Boolean)).toBe(false)
    expect(base.start).toMatch(/17$/)
    expect(base.end).toMatch(/43$/)
  })
  it('tracks each end separately so editing end never resends start', () => {
    const base = roomEditorDefaults(room)
    const changed = roomEditorChanges({ ...base, end: '' }, base, false)
    expect(changed.start).toBe(false)
    expect(changed.end).toBe(true)
    expect(validRoomEditorSchedule({ ...base, end: '' }, changed, { start: room.constraints!.startAt, end: room.constraints!.endAt })).toBe(true)
  })
  it.each([0, 5000, 150000000])('F-13 keeps unchanged legacy budget %s valid for unrelated changes', budgetAmount => {
    const base = roomEditorDefaults({ ...room, constraints: { ...room.constraints!, budgetAmount } })
    expect(roomEditorSchemaFor(base).safeParse({ ...base, title: 'Tên mới' }).success).toBe(true)
    expect(roomEditorSchemaFor(base).safeParse({ ...base, budgetAmount: 9999 }).success).toBe(false)
  })
  it('keeps an unset legacy schedule valid until the user changes it', () => {
    const base = roomEditorDefaults({ ...room, constraints: undefined })
    const value = { ...base, title: 'Tên mới' }
    expect(validRoomEditorSchedule(value, roomEditorChanges(value, base, false), {})).toBe(true)
    const invalid = { ...value, end: '14/11/2026 18:00' }
    expect(validRoomEditorSchedule(invalid, roomEditorChanges(invalid, base, false), {})).toBe(false)
  })
  it('compares trimmed titles, geographic codes and numeric amounts rather than object identity', () => {
    const base = roomEditorDefaults(room)
    expect(roomEditorChanges({ ...base, title: '  Kèo  ' }, base, false).title).toBe(false)
    expect(roomEditorChanges({ ...base, budgetAmount: 300000 }, base, false).budgetAmount).toBe(false)
  })
})
