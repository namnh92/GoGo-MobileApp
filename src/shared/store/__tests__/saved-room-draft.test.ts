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
  useRoomStore.setState({ title: 'Cuối tuần', startTime: '19:00', budgetAmount: 500000, creationAttempt: { key: 'same-request', fingerprint: '{}' } })
  await saveRoomDraft('alice', 'mood')
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('places')
  expect(useRoomStore.getState()).toMatchObject({ title: 'Cuối tuần', startTime: '19:00', budgetAmount: 500000, creationAttempt: { key: 'same-request' } })
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

it('finishing resets the whole wizard without a personal preference handoff', () => {
  useRoomStore.setState({ title: 'Old', audience: 'group-host', participantCount: 9, startTime: '19:00' })
  useRoomStore.getState().finishDraft()
  expect(useRoomStore.getState()).toMatchObject({ title: '', audience: 'couple', startTime: null })
})

it('re-enters every step before the resumed one so Back keeps the wizard order', () => {
  expect(draftStepPath('budget', 'couple')).toEqual(['type', 'time', 'budget'])
  expect(draftStepPath('location', 'group-host')).toEqual(['type'])
  expect(draftStepPath('type', 'couple')).toEqual(['type'])
  // Retired group-setup snapshots normalize to the merged budget step.
  expect(draftStepPath('group-setup', 'couple')).toEqual(['type', 'time', 'budget'])
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

it('keeps the chosen length through save and resume, and reads older drafts without one (#204)', async () => {
  useRoomStore.setState({ startTime: '19:00', endTime: '22:00', durationPreset: 'upTo3h' })
  await saveRoomDraft('alice', 'time')
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('time')
  expect(useRoomStore.getState()).toMatchObject({ startTime: '19:00', endTime: '22:00', durationPreset: 'upTo3h' })

  // A snapshot written before the field existed still restores.
  const older = JSON.parse(storage.value as string)
  delete older.fields.durationPreset
  storage.value = JSON.stringify(older)
  useRoomStore.getState().resetDraft()
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('time')
  expect(useRoomStore.getState()).toMatchObject({ startTime: '19:00', durationPreset: null })
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

it('ADM-202: a pre-canonical area pick is dropped, with its centre, and resumes at step 1', async () => {
  storage.value = legacyDraft('budget', {})
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('type')
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

it('ADM-202 + #204: a v1 draft carrying a length preset migrates to v2 and keeps the preset', async () => {
  storage.value = legacyDraft('mood', { endTime: '22:00', durationPreset: 'upTo3h' })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('type')
  expect(useRoomStore.getState()).toMatchObject({
    administrativeArea: null, originLat: null, originLng: null, area: '',
    startTime: '19:00', endTime: '22:00', durationPreset: 'upTo3h',
  })
  await saveRoomDraft('alice', 'location')
  expect(JSON.parse(storage.value!)).toMatchObject({ version: 2, fields: { durationPreset: 'upTo3h' } })
})

it('ADM-202 + #204: a v1 draft without a preset migrates with none', async () => {
  storage.value = legacyDraft('time', { areaKey: null, area: 'Vị trí của tôi', originLat: 10.77, originLng: 106.7 })
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('time')
  expect(useRoomStore.getState()).toMatchObject({ durationPreset: null, originLat: 10.77 })
})

it.each(['couple', 'group-host'] as const)('round 3: cold-loads an old location-route draft at step 1 for %s', async audience => {
  useRoomStore.getState().setAudience(audience)
  useRoomStore.setState({ administrativeArea: AREA, radiusM: 10000, title: 'Resume' })
  await saveRoomDraft('alice', 'type')
  const previous = JSON.parse(storage.value!)
  previous.step = 'location'
  storage.value = JSON.stringify(previous)
  useRoomStore.getState().resetDraft()
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('type')
  expect(draftStepPath('location', audience)).toEqual(['type'])
  expect(useRoomStore.getState()).toMatchObject({ administrativeArea: AREA, radiusM: 10000, title: 'Resume', audience })
})

it('round 3: saves and resumes a step 1 GPS radius and the new group back stack', async () => {
  useRoomStore.setState({ audience: 'group-host', originLat: 21, originLng: 105, radiusM: null })
  await saveRoomDraft('alice', 'type')
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('type')
  expect(useRoomStore.getState()).toMatchObject({ originLat: 21, originLng: 105, radiusM: null })
  expect(draftStepPath('mood', 'group-host')).toEqual(['type', 'time', 'budget', 'places'])
})

it('reads a v2 mood snapshot, drops retired fields, and resumes places', async () => {
  await saveRoomDraft('alice', 'places')
  const old = JSON.parse(storage.value!)
  old.step = 'mood'
  Object.assign(old.fields, { moodKeys: ['chill'], settingKeys: ['inside'], spendingStyleKey: 'value', preferenceSeed: { roomId: 'old', moodKeys: ['chill'] } })
  storage.value = JSON.stringify(old)
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('places')
  for (const key of ['moodKeys', 'settingKeys', 'spendingStyleKey', 'preferenceSeed']) expect(useRoomStore.getState()).not.toHaveProperty(key)
  await saveRoomDraft('alice', 'mood')
  expect(JSON.parse(storage.value!).step).toBe('places')
  expect(JSON.parse(storage.value!).fields).not.toHaveProperty('moodKeys')
})

it.each(['couple', 'group-host', 'group-guest'] as const)('round 6v: old group-setup draft resumes at budget and next save normalizes (%s)', async audience => {
  useRoomStore.setState({ audience, participantCount: 7, budgetMode: 'total', budgetAmount: 650000 })
  await saveRoomDraft('alice', 'budget')
  const previous = JSON.parse(storage.value!)
  previous.step = 'group-setup'
  storage.value = JSON.stringify(previous)
  useRoomStore.getState().resetDraft()
  await loadRoomDraft('alice')
  expect(restoreRoomDraft('alice')).toBe('budget')
  expect(draftStepPath('group-setup', audience)).toEqual(['type', 'time', 'budget'])
  expect(useRoomStore.getState()).toMatchObject({ audience, participantCount: 7, budgetMode: 'total', budgetAmount: 650000 })
  await saveRoomDraft('alice', 'group-setup')
  expect(JSON.parse(storage.value!).step).toBe('budget')
})
