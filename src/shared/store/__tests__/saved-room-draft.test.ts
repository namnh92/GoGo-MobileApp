import { beforeEach, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async () => storage.value,
  setItem: async (_key: string, value: string) => { storage.value = value },
  removeItem: async () => { storage.value = null },
} }))
import { useRoomStore } from '../roomStore'
import { clearSavedRoomDraft, loadRoomDraft, restoreRoomDraft, saveRoomDraft, useSavedRoomDraft } from '../savedRoomDraft'

beforeEach(async () => { await clearSavedRoomDraft(); useRoomStore.getState().resetDraft() })

it('restores the saved step and fields after a cold load, including retry identity', async () => {
  useRoomStore.setState({ title: 'Cuối tuần', startTime: '19:00', budgetAmount: 500000, moodKeys: ['chill'], creationAttempt: { key: 'same-request', fingerprint: '{}' } })
  await saveRoomDraft('alice', 'mood')
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('mood')
  expect(useRoomStore.getState()).toMatchObject({ title: 'Cuối tuần', startTime: '19:00', budgetAmount: 500000, moodKeys: ['chill'], creationAttempt: { key: 'same-request' } })
})

it('never restores another account draft and removes it from disk', async () => {
  await saveRoomDraft('alice', 'budget')
  expect(restoreRoomDraft('bob')).toBeNull()
  await loadRoomDraft('bob')
  expect(storage.value).toBeNull()
  expect(useSavedRoomDraft.getState().draft).toBeNull()
})

it('rejects corrupt or unsupported persisted data', async () => {
  for (const value of ['invalid-json', '{"version":999}', '{"version":1,"fields":{"originLat":999}}']) {
    storage.value = value
    await loadRoomDraft('alice')
    expect(restoreRoomDraft('alice')).toBeNull()
  }
})

it('logout clear wins over an in-flight save', async () => {
  const saving = saveRoomDraft('alice', 'time')
  await clearSavedRoomDraft()
  await saving
  expect(storage.value).toBeNull()
  expect(useSavedRoomDraft.getState().draft).toBeNull()
})

it('finishing resets the whole wizard but keeps preferences scoped to the created room', () => {
  useRoomStore.setState({ title: 'Old', audience: 'group-host', participantCount: 9, startTime: '19:00', moodKeys: ['chill'] })
  useRoomStore.getState().finishDraft('room-1')
  expect(useRoomStore.getState()).toMatchObject({ title: '', audience: 'couple', startTime: null, moodKeys: [], preferenceSeed: { roomId: 'room-1', moodKeys: ['chill'] } })
})
