import { z } from 'zod'
import { getSecureItem, setOrDeleteSecureItem } from './secure-store'
import type { SavedArea } from '@/shared/location/area-controller'

const KEY = 'gogo.current-area.v1'
const savedArea = z.object({
  manual: z.boolean(),
  area: z.object({
    datasetVersion: z.string().min(1), provinceCode: z.string().min(1), provinceName: z.string().min(1),
    communeCode: z.string().nullable(), communeName: z.string().nullable(),
  }),
})
export async function loadCurrentArea(): Promise<SavedArea | null> {
  try {
    const value = await getSecureItem(KEY)
    return value ? savedArea.parse(JSON.parse(value)) : null
  } catch { return null }
}
export async function saveCurrentArea(value: SavedArea | null): Promise<void> {
  await setOrDeleteSecureItem(KEY, value ? JSON.stringify(value) : null)
}
