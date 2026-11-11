import { z } from 'zod'
import type { RoomDraft } from '@/shared/store/roomStore'

const code = z.string().regex(/^\d{2,5}$/)
const pickerScopeSchema = z.discriminatedUnion('source', [
  z.object({ status: z.literal('ready'), source: z.literal('selected_area'), area: z.object({
    datasetVersion: z.string().min(1).max(200), provinceCode: code, provinceName: z.string(),
    communeCode: code.nullable(), communeName: z.string().nullable(),
  }) }),
  z.object({ status: z.literal('ready'), source: z.literal('gps'),
    position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
    // Search defaults an omitted radius to 10km; null cannot mean unlimited here.
    radiusM: z.number().int().min(100).max(100000),
  }),
])

export type PickerScope = z.infer<typeof pickerScopeSchema>

/** Freeze the wizard's own scope at navigation; never read global discovery state. */
export function draftPickerScope(draft: Pick<RoomDraft, 'administrativeArea' | 'originLat' | 'originLng' | 'radiusM'>): PickerScope | null {
  const parsed = pickerScopeSchema.safeParse(draft.administrativeArea
    ? { status: 'ready', source: 'selected_area', area: draft.administrativeArea }
    : { status: 'ready', source: 'gps', position: { lat: draft.originLat, lng: draft.originLng }, radiusM: draft.radiusM })
  return parsed.success ? parsed.data : null
}

/** Malformed explicit picker data must fail closed, never search another area. */
export function readPickerScope(value: string | undefined): PickerScope | null {
  try {
    const parsed = pickerScopeSchema.safeParse(JSON.parse(value ?? ''))
    return parsed.success ? parsed.data : null
  } catch { return null }
}
