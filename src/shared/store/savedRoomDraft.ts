import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { z } from 'zod'
import { useRoomStore } from './roomStore'

export const draftStepSchema = z.enum(['type', 'group-setup', 'location', 'time', 'budget', 'mood'])
export type DraftStep = z.infer<typeof draftStepSchema>
const nullableNumber = z.number().finite().nullable()
export const savedRoomDraftSchema = z.object({
  version: z.literal(1),
  ownerId: z.string().min(1),
  step: draftStepSchema,
  fields: z.object({
    creationAttempt: z.object({ key: z.string(), fingerprint: z.string() }).nullable(),
    title: z.string().max(80), audience: z.enum(['couple', 'group-host', 'group-guest']),
    participantCount: z.number().int().min(2).max(20), budgetMode: z.enum(['total', 'per_person']),
    quickPreset: z.enum(['tonight', 'weekend', 'special']),
    decisionMode: z.enum(['match', 'vote', 'host']),
    budgetAmount: z.number().int().nonnegative().nullable(), currency: z.string(),
    area: z.string(), areaKey: z.string().nullable(),
    originLat: z.number().min(-90).max(90).nullable(), originLng: z.number().min(-180).max(180).nullable(),
    radiusM: nullableNumber,
    startAt: z.string().datetime().nullable(), endAt: z.string().datetime().nullable(),
    startTime: z.string().nullable(), endTime: z.string().nullable(),
    moodKeys: z.array(z.string()).max(3), settingKeys: z.array(z.string()).max(2),
    spendingStyleKey: z.string().nullable(),
    seedPlaces: z.array(z.object({ placeId: z.string(), name: z.string() })).max(10),
  }),
})
type SavedDraft = z.infer<typeof savedRoomDraftSchema>
const KEY = 'gogo.room-draft.v1'
export const useSavedRoomDraft = create<{ draft: SavedDraft | null }>(() => ({ draft: null }))

// Serialize disk writes and invalidate in-flight hydration on logout/clear.
let generation = 0
let writes: Promise<void> = Promise.resolve()
function write(action: () => Promise<void>): Promise<void> {
  writes = writes.catch(() => undefined).then(action)
  return writes
}

export async function loadRoomDraft(ownerId: string | null): Promise<void> {
  const readGeneration = ++generation
  useSavedRoomDraft.setState({ draft: null })
  try {
    await writes.catch(() => undefined)
    const raw = await AsyncStorage.getItem(KEY)
    const parsed = savedRoomDraftSchema.safeParse(raw ? JSON.parse(raw) : null)
    if (readGeneration !== generation) return
    if (parsed.success && parsed.data.ownerId === ownerId) {
      useSavedRoomDraft.setState({ draft: parsed.data })
    } else {
      await clearSavedRoomDraft()
    }
  } catch {
    // An unreadable snapshot must never be restored as trusted form state.
    if (readGeneration === generation) useSavedRoomDraft.setState({ draft: null })
  }
}

export async function saveRoomDraft(ownerId: string, step: DraftStep): Promise<void> {
  const snapshot = savedRoomDraftSchema.parse({ version: 1, ownerId, step, fields: useRoomStore.getState() })
  const saveGeneration = ++generation
  await write(() => AsyncStorage.setItem(KEY, JSON.stringify(snapshot)))
  if (saveGeneration === generation) useSavedRoomDraft.setState({ draft: snapshot })
}

export async function clearSavedRoomDraft(): Promise<void> {
  ++generation
  useSavedRoomDraft.setState({ draft: null })
  await write(() => AsyncStorage.removeItem(KEY))
}

export function restoreRoomDraft(ownerId: string): DraftStep | null {
  const snapshot = useSavedRoomDraft.getState().draft
  if (!snapshot || snapshot.ownerId !== ownerId) return null
  useRoomStore.getState().resetDraft()
  useRoomStore.setState(snapshot.fields)
  return snapshot.step
}

/**
 * Every wizard route up to and including `step`, in the order the wizard
 * walks them. A resumed draft pushes this whole path (not just its step) so
 * Back returns to the previous step with restored data instead of leaving
 * the wizard — the same shape the stack has when the user got there by hand.
 */
export function draftStepPath(step: DraftStep, audience: 'couple' | 'group-host' | 'group-guest'): DraftStep[] {
  const order: DraftStep[] = audience === 'couple'
    ? ['type', 'location', 'time', 'budget', 'mood']
    : ['type', 'group-setup', 'location', 'time', 'budget', 'mood']
  const index = order.indexOf(step)
  return index < 0 ? ['type'] : order.slice(0, index + 1)
}
