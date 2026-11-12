import { z } from 'zod'
import type { RoomSummary } from '@/shared/api'
import { isoToLocalSchedule, localScheduleToIso } from './room-schedule'

export const roomEditorSchema = z.object({
  title: z.string().trim().max(80),
  gps: z.object({ lat: z.number(), lng: z.number(), label: z.string().nullable() }).nullable(),
  area: z.object({ datasetVersion: z.string(), provinceCode: z.string(), provinceName: z.string(), communeCode: z.string().nullable(), communeName: z.string().nullable() }).nullable(),
  budgetAmount: z.number().int().nonnegative(),
  budgetMode: z.enum(['total', 'per_person']),
  participantCount: z.number().int().min(2).max(20),
  radiusM: z.number().int().positive().nullable(),
  start: z.string(),
  end: z.string(),
})

export type RoomEditorValues = z.infer<typeof roomEditorSchema>

export function roomEditorDefaults(room: RoomSummary): RoomEditorValues {
  return {
    title: room.title ?? '',
    // Coordinates are intentionally absent from RoomSummary. Null means leave
    // the stored origin untouched, until the host explicitly replaces it.
    gps: null,
    area: room.constraints?.administrativeArea ?? null,
    budgetAmount: room.constraints?.budgetAmount ?? 0,
    budgetMode: room.constraints?.budgetMode ?? 'total',
    participantCount: room.participantCount,
    radiusM: room.constraints?.radiusM ?? null,
    start: isoToLocalSchedule(room.constraints?.startAt ?? room.scheduledDate),
    end: isoToLocalSchedule(room.constraints?.endAt),
  }
}

export function roomEditorChanges(value: RoomEditorValues, base: RoomEditorValues, staleArea: boolean) {
  const area = value.area !== null && (staleArea
    || value.area.datasetVersion !== base.area?.datasetVersion
    || value.area.provinceCode !== base.area?.provinceCode
    || value.area.communeCode !== base.area?.communeCode)
  return {
    title: value.title.trim() !== base.title.trim(),
    area,
    gps: !!value.gps && (value.gps.lat !== base.gps?.lat || value.gps.lng !== base.gps?.lng),
    budgetAmount: value.budgetAmount !== base.budgetAmount,
    budgetMode: value.budgetMode !== base.budgetMode,
    participantCount: value.participantCount !== base.participantCount,
    radiusM: !value.area && value.radiusM !== base.radiusM,
    // Compare the local fields first: converting an untouched value to ISO
    // would otherwise truncate the server's seconds/milliseconds.
    start: value.start.trim() !== base.start.trim(),
    end: value.end.trim() !== base.end.trim(),
  }
}

/** Validate the merged window only when editing it; an unset legacy schedule
 * must not prevent an unrelated title, area or budget edit. */
export function validRoomEditorSchedule(value: RoomEditorValues, changed: ReturnType<typeof roomEditorChanges>, window: { start?: string; end?: string }) {
  if (!changed.start && !changed.end) return true
  const start = changed.start ? localScheduleToIso(value.start) : window.start
  const end = changed.end ? (value.end.trim() ? localScheduleToIso(value.end) : null) : window.end
  if (!start || (changed.end && value.end.trim() && !end)) return false
  return Number.isFinite(Date.parse(start)) && (!end || Date.parse(end) > Date.parse(start))
}
