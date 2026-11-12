import { z } from 'zod'
import { randomUUID } from 'expo-crypto'
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

// Only one wizard picker is active. Never persist this snapshot or put it in a URL.
let activeScope: { id: string; scope: PickerScope; priceMaxPerPerson?: number } | null = null

export function savePickerScope(scope: PickerScope, priceMaxPerPerson?: number): string {
  const id = randomUUID()
  activeScope = { id, scope: pickerScopeSchema.parse(scope), priceMaxPerPerson }
  return id
}

/** Unknown/closed picker ids fail closed; serialized route scopes are not accepted. */
export function readPickerScope(id: string | undefined): PickerScope | null {
  return activeScope && activeScope.id === id ? activeScope.scope : null
}

/** Both the picker and its wizard owner release the transient snapshot on exit. */
export function clearPickerScope(id: string | null | undefined): void {
  if (activeScope?.id === id) activeScope = null
}

/** Initial filter for this opaque picker session; normal search remains independent. */
export function readPickerPriceMax(id: string | undefined): number | undefined {
  return activeScope?.id === id ? activeScope?.priceMaxPerPerson : undefined
}
