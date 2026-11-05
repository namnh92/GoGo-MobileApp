import { beforeEach, expect, it, vi } from 'vitest'
import { useRoomStore } from '../roomStore'
import { clearSavedRoomDraft, loadRoomDraft, restoreRoomDraft, saveRoomDraft, useSavedRoomDraft } from '../savedRoomDraft'
const storage = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async () => storage.value,
  setItem: async (_key: string, value: string) => { storage.value = value },
  removeItem: async () => { storage.value = null },
} }))

beforeEach(async () => { await clearSavedRoomDraft(); useRoomStore.getState().resetDraft() })

it('keeps the chosen day with the times, and a draft saved before the day existed resumes on today (#501)', async () => {
  useRoomStore.setState({ startTime: '19:00', scheduleDay: '2999-01-02', startAt: '2999-01-02T12:00:00.000Z' })
  await saveRoomDraft('alice', 'time')
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  restoreRoomDraft('alice')
  expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2999-01-02', startAt: '2999-01-02T12:00:00.000Z' })

  const old = JSON.parse(storage.value as string)
  delete old.fields.scheduleDay
  storage.value = JSON.stringify(old)
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  restoreRoomDraft('alice')
  expect(useRoomStore.getState().scheduleDay).toBeNull()
})
