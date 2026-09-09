import { act, fireEvent } from '@testing-library/react-native'

import { loaded, renderScreen, type QueryLike } from './harness'

/**
 * PROF-APP-004 (#179), ADR-0022 — the home area is a default the wizard
 * offers, never applies: a chip while the draft has no area and no origin,
 * gone the moment either is set, and a tap that fills the draft with the
 * curated area's key and centre exactly as the picker's fallback would.
 */

const mockMe: { query: QueryLike } = { query: loaded(undefined) }
const mockAreas: { query: QueryLike } = { query: loaded({ areas: [] }) }
const mockSession = { status: 'user' as string }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: true }),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status }),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useAreaAutocomplete: () => ({
    data: { predictions: [], attribution: '' },
    isPending: false,
    isError: false,
    endSession: jest.fn(),
  }),
  useMe: () => mockMe.query,
  useServiceAreas: () => mockAreas.query,
}))

import CreateLocationScreen from '@/features/create-date/create-location.view'
import { useRoomStore } from '@/shared/store/roomStore'

const AREAS = {
  areas: [{ key: 'hcm_q1', name: 'Quận 1', city: 'TP.HCM', lat: 10.7769, lng: 106.7009 }],
}
const CHIP = /Dùng khu vực mặc định: Quận 1, TP\.HCM/

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  useRoomStore.getState().setArea('Thảo Điền, TP.HCM')
  mockSession.status = 'user'
  mockMe.query = loaded({ homeArea: { key: 'hcm_q1', name: 'Quận 1', city: 'TP.HCM' } })
  mockAreas.query = loaded(AREAS)
})

describe('home area prefill on the location step', () => {
  it('offers the home area while the draft has neither area nor origin', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.getByText(CHIP)).toBeTruthy()
  })

  it('fills the draft with the curated key and centre on a tap, and only then', async () => {
    const view = await renderScreen(<CreateLocationScreen />)
    expect(useRoomStore.getState().areaKey).toBeNull()
    await act(async () => {
      fireEvent.press(view.getByText(CHIP))
    })
    expect(useRoomStore.getState()).toMatchObject({
      areaKey: 'hcm_q1',
      originLat: 10.7769,
      originLng: 106.7009,
      area: 'Quận 1, TP.HCM',
    })
    // Applied means the draft has an area, so the offer is gone.
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is not offered once the draft already has an area', async () => {
    useRoomStore.getState().patchDraft({ areaKey: 'other', originLat: 10.8, originLng: 106.7 })
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.queryByText(CHIP)).toBeNull()
  })

  it('is not offered without a home area, or when the area was retired', async () => {
    mockMe.query = loaded({ homeArea: null })
    const none = await renderScreen(<CreateLocationScreen />)
    expect(none.queryByText(CHIP)).toBeNull()
    none.unmount()

    mockMe.query = loaded({ homeArea: { key: 'gone', name: 'Khu cũ', city: 'TP.HCM' } })
    const retired = await renderScreen(<CreateLocationScreen />)
    expect(retired.queryByText(/Dùng khu vực mặc định/)).toBeNull()
  })

  it('is never offered to a guest', async () => {
    mockSession.status = 'guest'
    mockMe.query = loaded(undefined)
    const view = await renderScreen(<CreateLocationScreen />)
    expect(view.queryByText(/Dùng khu vực mặc định/)).toBeNull()
  })
})
