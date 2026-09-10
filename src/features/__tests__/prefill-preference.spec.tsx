import { act, fireEvent } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

/**
 * PROF-APP-004 (#179), ADR-0022 — saved interests are offered on the room
 * preference screen only while nothing is chosen and nothing was ever saved
 * for this room; a tap fills the local draft and nothing else. Autosave still
 * runs only when the person continues, and a guest never sees the chip.
 */

const mockMe: { query: QueryLike } = { query: loaded(undefined) }
const mockPreferences: { query: QueryLike } = { query: loaded({ selections: {}, version: 0 }) }
const mockSave = jest.fn()
const mockComplete = jest.fn()
const mockSession = { status: 'user' as string }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
  useMyPreferences: () => mockPreferences.query,
  useSaveMyPreferences: () => ({ mutateAsync: mockSave, isPending: false }),
  useCompleteMyPreferences: () => ({ mutateAsync: mockComplete, isPending: false }),
  useTaxonomies: () => ({
    isPending: false,
    isError: false,
    data: {
      kinds: {
        mood: [
          { key: 'chill', sortOrder: 0, labels: { vi: 'Thư giãn' } },
          { key: 'lively', sortOrder: 1, labels: { vi: 'Sôi động' } },
          { key: 'cozy', sortOrder: 2, labels: { vi: 'Ấm cúng' } },
        ],
      },
    },
    refetch: jest.fn(),
  }),
}))

import PreferenceScreen from '@/features/matching/preference.view'
import { useRoomStore } from '@/shared/store/roomStore'

const CHIP = 'Dùng sở thích đã lưu'

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  mockSession.status = 'user'
  mockMe.query = loaded({ interests: { mood: ['chill', 'retired_key', 'cozy'] } })
  mockPreferences.query = loaded({ selections: {}, version: 0 })
  mockSave.mockReset()
  mockComplete.mockReset()
})

describe('saved interests prefill on the preference screen', () => {
  it('offers the saved interests while nothing is chosen and nothing was saved', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('fills the local draft on a tap, skipping keys the room no longer offers, and saves nothing', async () => {
    const view = await renderScreen(<PreferenceScreen />)
    await act(async () => {
      fireEvent.press(view.getByText(CHIP))
    })
    expect(view.getByText('Thư giãn')).toBeTruthy()
    expect(view.getByText('Ấm cúng')).toBeTruthy()
    expect(view.getByText(/Tiếp tục \(2\)/)).toBeTruthy()
    expect(view.queryByText(CHIP)).toBeNull()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('is not offered once a draft was saved for this room, even an empty one', async () => {
    mockPreferences.query = loaded({ selections: { mood: [] }, version: 2 })
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is not offered when the wizard already seeded a pick', async () => {
    useRoomStore.getState().patchDraft({ moodKeys: ['lively'] })
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is never offered to a guest', async () => {
    mockSession.status = 'guest'
    mockMe.query = loaded(undefined)
    const view = await renderScreen(<PreferenceScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })
})
