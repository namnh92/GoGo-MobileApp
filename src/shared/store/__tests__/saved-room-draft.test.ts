import { beforeEach, expect, it, vi } from 'vitest'
import { useRoomStore } from '../roomStore'
import { clearSavedRoomDraft, draftStepPath, loadRoomDraft, restoreRoomDraft, saveRoomDraft, useSavedRoomDraft } from '../savedRoomDraft'
const storage = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async () => storage.value,
  setItem: async (_key: string, value: string) => { storage.value = value },
  removeItem: async () => { storage.value = null },
} }))

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

it('re-enters every step before the resumed one so Back keeps the wizard order', () => {
  expect(draftStepPath('budget', 'couple')).toEqual(['type', 'location', 'time', 'budget'])
  expect(draftStepPath('location', 'group-host')).toEqual(['type', 'group-setup', 'location'])
  expect(draftStepPath('type', 'couple')).toEqual(['type'])
  // A couple draft cannot be on the group step; fall back to the first step.
  expect(draftStepPath('group-setup', 'couple')).toEqual(['type'])
})

const AREA = {
  datasetVersion: 'ds-2026',
  provinceCode: '79',
  provinceName: 'Thành phố Hồ Chí Minh',
  communeCode: '26734',
  communeName: 'Phường Bến Thành',
}

it('ADM-202: restores the canonical area with codes, dataset version and labels', async () => {
  useRoomStore.setState({ administrativeArea: AREA, budgetAmount: 300000 })
  await saveRoomDraft('alice', 'time')
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('time')
  expect(useRoomStore.getState().administrativeArea).toEqual(AREA)
  expect(JSON.parse(storage.value!).version).toBe(2)
})

function legacyDraft(step: string, fields: Record<string, unknown>) {
  return JSON.stringify({
    version: 1,
    ownerId: 'alice',
    step,
    fields: {
      creationAttempt: null, title: 'Cũ', audience: 'couple', participantCount: 4, budgetMode: 'per_person',
      quickPreset: 'tonight', decisionMode: 'match', budgetAmount: 500000, currency: 'VND',
      area: 'Thảo Điền, TP.HCM', areaKey: 'places:thao-dien', originLat: 10.803, originLng: 106.735, radiusM: 5000,
      startAt: null, endAt: null, startTime: '19:00', endTime: null,
      moodKeys: [], settingKeys: [], spendingStyleKey: null, seedPlaces: [],
      ...fields,
    },
  })
}

it('ADM-202: a pre-canonical area pick is dropped, with its centre, and resumes at the location step', async () => {
  storage.value = legacyDraft('budget', {})
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('location')
  expect(useRoomStore.getState()).toMatchObject({
    administrativeArea: null, originLat: null, originLng: null, area: '', title: 'Cũ', budgetAmount: 500000,
  })
})

it('ADM-202: a pre-canonical device position is kept where it was', async () => {
  storage.value = legacyDraft('budget', { areaKey: null, area: 'Vị trí của tôi', originLat: 10.77, originLng: 106.7 })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('budget')
  expect(useRoomStore.getState()).toMatchObject({ administrativeArea: null, originLat: 10.77, originLng: 106.7 })
})

