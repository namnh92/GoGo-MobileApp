import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { api } from '@/shared/api/client'
import { ApiError, TimeoutError } from '@/shared/api/errors'
import type { OpBody, RoomSummary } from '@/shared/api'
import * as identity from '@/shared/api/idempotency'
import * as saved from '@/shared/store/savedRoomDraft'
import { toCreateRoomBody, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import i18n from '@/shared/i18n'
import { useCreateRoomDraft } from '../use-create-room-draft'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockInvite = jest.fn()
const mockIntroduction = jest.fn()
let mockStatus = 'user'
let mockOwner: string | undefined = 'owner'
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, session: { userId: mockOwner } }) }))
jest.mock('@/features/gogo-room/prepare-room-invite', () => ({ prepareRoomInvite: (...args: unknown[]) => mockInvite(...args) }))
jest.mock('@/shared/store/assistantIntroStore', () => ({ noteAssistantPlanCreated: (...args: unknown[]) => mockIntroduction(...args) }))

type Body = OpBody<'createRoom'>
type Draft = ReturnType<typeof useRoomStore.getState>
const diskKey = 'gogo.room-draft.v1'
const at = (hour: number, minute = 0) => new Date(2026, 10, 12, hour, minute)
const startAt = at(19).toISOString()
const room = { id: 'original-room', type: 'group', decisionMode: 'vote', status: 'collecting', participantCount: 4 } as RoomSummary
let client: QueryClient
let keys: jest.SpyInstance
let post: jest.SpyInstance
let patch: jest.SpyInstance
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
const mount = () => renderHook(useCreateRoomDraft, { wrapper })
type Hook = Awaited<ReturnType<typeof mount>>
const submit = (hook: Hook) => act(async () => { await hook.result.current.submit() })
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function disk() {
  return JSON.parse((await AsyncStorage.getItem(diskKey))!)
}
async function attempt(key = 'K') {
  const body = toCreateRoomBody(useRoomStore.getState())
  const selected = { key, fingerprint: JSON.stringify(body) }
  useRoomStore.setState({ creationAttempt: selected })
  await saved.saveRoomDraft('owner', 'places')
  return { body, selected }
}
function expectSend(index: number, body: Body, key: string) {
  expect(post.mock.calls[index]).toEqual(['/rooms', body, { idempotencyKey: key }])
}
function expectReleased() { expect(useRoomStore.getState().creationPending).toBe(false) }

beforeEach(async () => {
  jest.useFakeTimers({ now: at(18, 59) })
  jest.clearAllMocks()
  mockInvite.mockResolvedValue(undefined)
  mockStatus = 'user'; mockOwner = 'owner'
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  useRoomStore.setState({ creationPending: false })
  useRoomStore.getState().resetDraft()
  useRoomStore.setState({ audience: 'group-host', title: 'Evening', budgetAmount: 300000,
    scheduleDay: '2026-11-12', startTime: '19:00', startAt, endTime: '21:00', endAt: at(21).toISOString(),
    seedPlaces: [{ placeId: 'seed', name: 'Seed' }] })
  useRecentRoomsStore.setState({ rooms: [] })
  await saved.clearSavedRoomDraft()
  await i18n.changeLanguage('vi')
  let nextKey = 0
  keys = jest.spyOn(identity, 'newIdempotencyKey').mockImplementation(() => `new-key-${++nextKey}`)
  post = jest.spyOn(api, 'post').mockResolvedValue(room)
  patch = jest.spyOn(api, 'patch').mockResolvedValue(room)
})
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers() })
  client.clear()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it.each([0, 1])('clock crosses start: unchanged saved request replays at 19:%i', async minute => {
  const { body, selected } = await attempt()
  jest.setSystemTime(at(19, minute))
  const hook = await mount()
  await submit(hook)
  expectSend(0, body, selected.key)
  expect(keys).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledWith(`/room/${room.id}`)
})

it('matching replay skips all required fields, including legacy wizard-only invalid fields', async () => {
  await attempt()
  // These are not in the body of a group request; required-step validation would reject them.
  useRoomStore.setState({ startTime: null })
  jest.setSystemTime(at(19, 1))
  const body = toCreateRoomBody(useRoomStore.getState())
  const hook = await mount()
  await submit(hook)
  expectSend(0, body, 'K')
  expect(mockPush).not.toHaveBeenCalled()
  expect(keys).not.toHaveBeenCalled()
})

it.each([false, true])('lost response then retry (restart=%s) creates one room with the same body and key', async restart => {
  const body = toCreateRoomBody(useRoomStore.getState())
  const rooms = new Map<string, RoomSummary>()
  let creations = 0
  post.mockImplementation(async (_path: string, request: Body, options: { idempotencyKey: string }) => {
    expect(request).toEqual(body)
    const persisted = await disk()
    expect(toCreateRoomBody(persisted.fields)).toEqual(body)
    expect(persisted.fields.creationAttempt).toEqual({ key: options.idempotencyKey, fingerprint: JSON.stringify(body) })
    if (!rooms.has(options.idempotencyKey)) {
      rooms.set(options.idempotencyKey, room); creations++
      throw new TimeoutError(15000)
    }
    return rooms.get(options.idempotencyKey)
  })
  let hook = await mount()
  await submit(hook)
  const selected = useRoomStore.getState().creationAttempt!
  expect(hook.result.current.error).toBe(i18n.t('createPlaces.createFailed'))
  expect(mockReplace).not.toHaveBeenCalled()
  expectReleased()
  jest.setSystemTime(at(19, 1))
  if (restart) {
    await hook.unmount()
    useRoomStore.getState().resetDraft()
    saved.useSavedRoomDraft.setState({ draft: null })
    await saved.loadRoomDraft('owner')
    expect(saved.restoreRoomDraft('owner')).toBe('places')
    expect(useRoomStore.getState()).toMatchObject({ startAt, scheduleDay: '2026-11-12', startTime: '19:00', creationAttempt: selected })
    hook = await mount()
  }
  await submit(hook)
  expect(post).toHaveBeenCalledTimes(2)
  expectSend(0, body, selected.key); expectSend(1, body, selected.key)
  expect(creations).toBe(1)
  expect(keys).toHaveBeenCalledTimes(1)
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith(`/room/${room.id}`)
  expect(useRecentRoomsStore.getState().rooms[0].roomId).toBe(room.id)
  expect(mockInvite).toHaveBeenCalledWith(client, room.id)
  expect(mockIntroduction).toHaveBeenCalledWith('owner')
  expect(useRoomStore.getState().creationAttempt).toBeNull()
  expect(saved.useSavedRoomDraft.getState().draft).toBeNull()
  expect(await AsyncStorage.getItem(diskKey)).toBeNull()
  expectReleased()
})

it('422 past-start response retains disk identity; unchanged retry replays, validated correction persists K2', async () => {
  const { body, selected } = await attempt()
  jest.setSystemTime(at(19, 1))
  const error = new ApiError(422, { code: 'VALIDATION_ERROR', message: 'invalid', field_errors: [
    { field: 'constraint.startAt', code: 'INVALID_TIME', message: 'Choose a future start time' },
    { field: 'constraint.endAt', code: 'INVALID_TIME', message: 'Second field error' },
  ] })
  post.mockRejectedValueOnce(error).mockRejectedValueOnce(error)
  const hook = await mount()
  await submit(hook)
  expect(hook.result.current.error).toBe('Choose a future start time')
  expect(mockReplace).not.toHaveBeenCalled()
  expectReleased()
  expect(useRoomStore.getState().creationAttempt).toEqual(selected)
  expect((await disk()).fields.creationAttempt).toEqual(selected)
  await submit(hook)
  expectSend(0, body, 'K'); expectSend(1, body, 'K')
  expect(keys).not.toHaveBeenCalled()
  await act(async () => {
    useRoomStore.getState().setStartTime('20:00')
    useRoomStore.getState().patchDraft({ startAt: at(20).toISOString() })
  })
  const corrected = toCreateRoomBody(useRoomStore.getState())
  post.mockImplementationOnce(async () => {
    const persisted = await disk()
    expect(toCreateRoomBody(persisted.fields)).toEqual(corrected)
    expect(persisted.fields.creationAttempt).toEqual({ key: 'new-key-1', fingerprint: JSON.stringify(corrected) })
    return room
  })
  await submit(hook)
  expectSend(2, corrected, 'new-key-1')
  expect(keys).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith(`/room/${room.id}`)
})

it.each([false, true])('changed draft after timeout validates before replacing identity (past=%s)', async past => {
  const body = toCreateRoomBody(useRoomStore.getState())
  post.mockRejectedValue(new TimeoutError(15000))
  const hook = await mount()
  await submit(hook)
  const selected = useRoomStore.getState().creationAttempt!
  if (past) jest.setSystemTime(at(19, 1))
  await act(async () => { useRoomStore.getState().patchDraft({ title: 'Changed' }) })
  const changed = toCreateRoomBody(useRoomStore.getState())
  await submit(hook)
  if (past) {
    expect(mockPush).toHaveBeenLastCalledWith('/create/time')
    expect(post).toHaveBeenCalledTimes(1)
    expect(keys).toHaveBeenCalledTimes(1)
    expect(useRoomStore.getState().creationAttempt).toEqual(selected)
    expect((await disk()).fields.creationAttempt).toEqual(selected)
    await act(async () => { useRoomStore.getState().patchDraft({ title: 'Evening' }) })
    await submit(hook)
    expectSend(1, body, selected.key)
    expect(keys).toHaveBeenCalledTimes(1)
  } else {
    expect(post).toHaveBeenCalledTimes(2)
    expectSend(1, changed, 'new-key-2')
    expect(keys).toHaveBeenCalledTimes(2)
    expect((await disk()).fields.creationAttempt).toEqual({ key: 'new-key-2', fingerprint: JSON.stringify(changed) })
    expect(toCreateRoomBody((await disk()).fields)).toEqual(changed)
  }
  expectReleased()
})

const invalidCases: [Partial<Draft>, string][] = [
  [{ title: 'x'.repeat(81), startTime: null, startAt: null }, 'type'],
  [{ startTime: null, startAt: null, budgetAmount: null }, 'time'],
  [{ startTime: '18:00', startAt: at(18).toISOString(), budgetAmount: null }, 'time'],
  [{ startTime: '25:00', budgetAmount: null }, 'time'],
  [{ startAt: 'invalid', budgetAmount: null }, 'time'],
  [{ budgetAmount: null }, 'budget'],
  [{ participantCount: 2 }, 'budget'],
  [{ participantCount: 13 }, 'budget'],
]
describe.each([false, true])('F-23 ordering, mismatching attempt=%s', mismatch => {
  it.each(invalidCases)('rejects %j at %s without send/key allocation', async (fields, step) => {
    const previous = mismatch ? (await attempt()).selected : null
    useRoomStore.setState(fields)
    const hook = await mount()
    await submit(hook)
    expect(mockPush).toHaveBeenCalledWith(`/create/${step}`)
    expect(post).not.toHaveBeenCalled()
    expect(keys).not.toHaveBeenCalled()
    expect(useRoomStore.getState().creationAttempt).toEqual(previous)
    if (fields.budgetAmount === null && step === 'budget') expect(hook.result.current.error).toBe(i18n.t('budgetPicker.required'))
    expectReleased()
  })
})

it('an empty saved key is not a replay and cannot bypass freshness validation', async () => {
  await attempt('')
  jest.setSystemTime(at(19, 1))
  const hook = await mount()
  await submit(hook)
  expect(mockPush).toHaveBeenCalledWith('/create/time')
  expect(post).not.toHaveBeenCalled()
  expect(keys).not.toHaveBeenCalled()
  expectReleased()
})

it('persistence barrier blocks sending and draft edits, then sends exactly the saved snapshot', async () => {
  const body = toCreateRoomBody(useRoomStore.getState())
  const gate = deferred()
  const save = saved.saveRoomDraft
  const saving = jest.spyOn(saved, 'saveRoomDraft').mockImplementation(async (owner, step) => {
    await gate.promise
    await save(owner, step)
  })
  const hook = await mount()
  let transaction!: Promise<void>
  await act(async () => { transaction = hook.result.current.submit() })
  expect(saving).toHaveBeenCalledWith('owner', 'places')
  expect(post).not.toHaveBeenCalled()
  expect(useRoomStore.getState().creationPending).toBe(true)
  await act(async () => {
    const state = useRoomStore.getState()
    state.patchDraft({ title: 'Unexpected edit', startAt: at(20).toISOString() })
    state.setAudience('couple'); state.setParticipantCount(7); state.setBudgetMode('total')
    state.setQuickPreset('weekend'); state.setArea('Changed area')
    state.setStartTime('20:00'); state.setEndTime(null); state.setDurationPreset('upTo2h')
    state.addSeedPlace({ placeId: 'other', name: 'Other' }); state.removeSeedPlace('seed')
  })
  expect(toCreateRoomBody(useRoomStore.getState())).toEqual(body)
  expect(useRoomStore.getState()).toMatchObject({ area: '', startTime: '19:00', endTime: '21:00', quickPreset: 'tonight', durationPreset: null, creationPending: true })
  post.mockImplementationOnce(async () => {
    const persisted = await disk()
    expect(toCreateRoomBody(persisted.fields)).toEqual(body)
    expect(persisted.fields.creationAttempt).toEqual({ key: 'new-key-1', fingerprint: JSON.stringify(body) })
    return room
  })
  await act(async () => { gate.resolve(); await transaction })
  expectSend(0, body, 'new-key-1')
  expectReleased()
})

it('persistence rejection sends nothing, releases guards and retries with the selected identity', async () => {
  const save = jest.spyOn(saved, 'saveRoomDraft').mockRejectedValueOnce(new Error('disk full'))
  const hook = await mount()
  await submit(hook)
  const selected = useRoomStore.getState().creationAttempt!
  expect(post).not.toHaveBeenCalled()
  expect(hook.result.current.error).toBe(i18n.t('createPlaces.createFailed'))
  expectReleased()
  // The next save uses the actual implementation; a past start must still replay.
  jest.setSystemTime(at(19, 1))
  await submit(hook)
  expect(save).toHaveBeenCalledTimes(2)
  expect(keys).toHaveBeenCalledTimes(1)
  expectSend(0, JSON.parse(selected.fingerprint), selected.key)
  expect(mockReplace).toHaveBeenCalledTimes(1)
})

describe.each(['save', 'network'] as const)('double-submit during deferred %s', phase => {
  it.each([false, true])('rejects synchronous calls across two hook instances=%s', async twoInstances => {
    const gate = deferred()
    if (phase === 'save') {
      const save = saved.saveRoomDraft
      jest.spyOn(saved, 'saveRoomDraft').mockImplementation(async (owner, step) => { await gate.promise; await save(owner, step) })
    } else post.mockImplementation(async () => { await gate.promise; return room })
    const first = await mount()
    const second = twoInstances ? await mount() : first
    let transaction!: Promise<void>
    let duplicate!: Promise<void>
    await act(async () => {
      transaction = first.result.current.submit()
      duplicate = second.result.current.submit()
    })
    const pending = useRoomStore.getState().creationPending
    const allocations = keys.mock.calls.length
    const sends = post.mock.calls.length
    let repeat!: Promise<void>
    await act(async () => { repeat = second.result.current.submit() })
    await act(async () => { gate.resolve(); await Promise.all([transaction, duplicate, repeat]) })
    expect(pending).toBe(true)
    expect(allocations).toBe(1)
    expect(sends).toBe(phase === 'save' ? 0 : 1)
    expect(post).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expectReleased()
  })
})

it('network pending freezes draft edits until a failed request releases the guards', async () => {
  const gate = deferred<RoomSummary>()
  post.mockReturnValueOnce(gate.promise)
  const body = toCreateRoomBody(useRoomStore.getState())
  const hook = await mount()
  let transaction!: Promise<void>
  await act(async () => { transaction = hook.result.current.submit() })
  await act(async () => { useRoomStore.getState().patchDraft({ title: 'Blocked edit' }); useRoomStore.getState().setStartTime('20:00') })
  const during = toCreateRoomBody(useRoomStore.getState())
  await act(async () => { gate.reject(new TimeoutError(15000)); await transaction })
  expect(during).toEqual(body)
  expect(toCreateRoomBody((await disk()).fields)).toEqual(body)
  expectReleased()
  await act(async () => { useRoomStore.getState().patchDraft({ title: 'Allowed edit' }) })
  expect(useRoomStore.getState().title).toBe('Allowed edit')
})

it('the selected transaction key is independent of subsequent mutable store reads', async () => {
  const { body } = await attempt()
  const save = saved.saveRoomDraft
  jest.spyOn(saved, 'saveRoomDraft').mockImplementation(async (owner, step) => {
    await save(owner, step)
    // Internal store replacement, outside the guarded public draft-edit actions.
    useRoomStore.setState({ creationAttempt: { key: 'unrelated-key', fingerprint: 'unrelated-body' } })
  })
  const hook = await mount()
  await submit(hook)
  expectSend(0, body, 'K')
  expect(keys).not.toHaveBeenCalled()
})

it('a shared pending guard rejects before validating even in a fresh hook instance', async () => {
  useRoomStore.setState({ creationPending: true, budgetAmount: null, startTime: null, startAt: null })
  const hook = await mount()
  await submit(hook)
  expect(mockPush).not.toHaveBeenCalled()
  expect(keys).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
  expect(useRoomStore.getState().creationPending).toBe(true)
})

it('holds the shared guard through success cleanup and navigation', async () => {
  const gate = deferred()
  const clear = saved.clearSavedRoomDraft
  jest.spyOn(saved, 'clearSavedRoomDraft').mockImplementation(async () => { await gate.promise; await clear() })
  const first = await mount()
  const second = await mount()
  let transaction!: Promise<void>
  await act(async () => { transaction = first.result.current.submit() })
  expect(post).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  expect(useRoomStore.getState().creationPending).toBe(true)
  await act(async () => { await second.result.current.submit() })
  expect(mockPush).not.toHaveBeenCalled()
  expect(keys).toHaveBeenCalledTimes(1)
  mockReplace.mockImplementationOnce(() => { expect(useRoomStore.getState().creationPending).toBe(true) })
  await act(async () => { gate.resolve(); await transaction })
  expect(mockReplace).toHaveBeenCalledTimes(1)
  expectReleased()
})

it.each([new Error('open offline'), new ApiError(422, { code: 'VALIDATION_ERROR', message: 'open rejected',
  field_errors: [{ field: 'constraint.startAt', code: 'INVALID_TIME', message: 'Open rejected after create' }] })])(
  'post-create open failure retains identity for a retry after start: %s', async error => {
    const body = toCreateRoomBody(useRoomStore.getState())
    const server = new Map<string, RoomSummary>()
    let creations = 0
    post.mockImplementation(async (_path: string, _body: Body, options: { idempotencyKey: string }) => {
      if (!server.has(options.idempotencyKey)) {
        server.set(options.idempotencyKey, { ...room, status: 'draft' }); creations++
      }
      return server.get(options.idempotencyKey)
    })
    patch.mockRejectedValueOnce(error).mockResolvedValue(room)
    const hook = await mount()
    await submit(hook)
    const selected = useRoomStore.getState().creationAttempt!
    expect(selected.key).toBeTruthy()
    expect((await disk()).fields.creationAttempt).toEqual(selected)
    expect(mockReplace).not.toHaveBeenCalled()
    expectReleased()
    jest.setSystemTime(at(19, 1))
    await submit(hook)
    expectSend(0, body, selected.key); expectSend(1, body, selected.key)
    expect(patch).toHaveBeenCalledTimes(2)
    expect(creations).toBe(1)
    expect(keys).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith(`/room/${room.id}`)
    expect(useRoomStore.getState().creationAttempt).toBeNull()
  },
)

it('requires the authenticated owner ID before allocating/persisting/sending', async () => {
  mockOwner = undefined
  const saving = jest.spyOn(saved, 'saveRoomDraft')
  const hook = await mount()
  await submit(hook)
  expect(post).not.toHaveBeenCalled()
  expect(saving).not.toHaveBeenCalled()
  expect(keys).not.toHaveBeenCalled()
  expect(hook.result.current.error).toBe(i18n.t('createPlaces.createFailed'))
  expectReleased()
})

it('preserves the account gate before acquiring guards', async () => {
  mockStatus = 'guest'
  const hook = await mount()
  await submit(hook)
  expect(mockPush).toHaveBeenCalledWith('/auth/sign-in?next=create')
  expect(post).not.toHaveBeenCalled()
  expect(keys).not.toHaveBeenCalled()
  expectReleased()
})

it('explicit discard drops identity after an unsuccessful mutation', async () => {
  const { selected } = await attempt()
  post.mockRejectedValueOnce(new TimeoutError(15000))
  const hook = await mount()
  await submit(hook)
  expect(useRoomStore.getState().creationAttempt).toEqual(selected)
  await act(async () => { useRoomStore.getState().resetDraft(); await saved.clearSavedRoomDraft() })
  expect(useRoomStore.getState().creationAttempt).toBeNull()
  expect(await AsyncStorage.getItem(diskKey)).toBeNull()
})
