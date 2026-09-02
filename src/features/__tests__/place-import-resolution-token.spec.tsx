import { act, fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import { ApiError } from '@/shared/api/errors'

/**
 * APP-042 — the Add Place screen carries the resolve proof to submit, so the
 * backend does not verify the same place with Google twice (GoGo-BE#337).
 *
 * The interesting half is the stale case. The token lives ten minutes; a user
 * who reads the preview, picks a category and types a note can easily outlive
 * it. The server refuses the stale token rather than quietly paying for another
 * Google call, so this screen has to resolve the link again itself — once —
 * instead of surfacing an error the user cannot act on.
 */

const RESOLVED = {
  status: 'RESOLVED',
  reasonCodes: ['EXACT_PROVIDER_ID'],
  resolutionToken: 'token-from-the-preview',
  candidate: {
    googlePlaceId: 'ChIJtest',
    name: 'Quán Thử',
    address: '1 Đường Thử, Quận 1',
    location: { lat: 10.77, lng: 106.7 },
    googleRating: 4.5,
    googleRatingCount: 120,
    googleScore: 82,
    businessStatus: 'OPERATIONAL',
    source: 'google_places',
    fetchedAt: '2026-09-02T10:00:00.000Z',
    attributions: ['Data © Google Maps'],
  },
}

const mockResolve = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
  data: undefined as unknown,
}

const mockSubmit = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as unknown,
  data: undefined as unknown,
}

const mockTrack = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockSubmit,
  usePlaceSubmission: () => ({ data: undefined }),
  useTaxonomies: () => ({ data: undefined }),
}))

import PlaceImportScreen from '@/features/place-import/import.view'

const LINK = 'https://maps.google.com/maps?place_id=ChIJtest'

/**
 * The CTA's handler is async, so the press has to be awaited inside one `act`.
 * Pressing outside it and polling with `waitFor` leaves React with overlapping
 * `act()` scopes, and the renderer does not recover for the rest of the file.
 */
async function pressSubmit(): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText('Gửi địa điểm cho GoGo'))
  })
}

const staleToken = () =>
  new ApiError(400, {
    code: 'RESOLUTION_TOKEN_INVALID',
    message: 'Cần mở lại liên kết để xác minh địa điểm rồi thử lại',
    retryable: true,
  })

async function openWithPreview(): Promise<void> {
  mockResolve.data = RESOLVED
  await renderScreen(<PlaceImportScreen />)
  // The screen re-resolves from its own input, so the link has to be in it.
  // Both the typing and the press go through `act`: an unwrapped state update
  // here leaves React with an open act scope, and every later render in the
  // file comes back empty.
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('https://maps.app.goo.gl/…'), LINK)
  })
}

describe('APP-042 — the resolve proof reaches submit', () => {
  beforeEach(() => {
    mockResolve.mutate.mockClear()
    mockResolve.mutateAsync.mockReset()
    mockSubmit.mutate.mockClear()
    mockSubmit.mutateAsync.mockReset()
    mockTrack.mockClear()
    mockResolve.data = undefined
    mockSubmit.isError = false
    mockSubmit.isSuccess = false
    mockSubmit.data = undefined
    mockSubmit.mutateAsync.mockResolvedValue({ status: 'PENDING', submissionId: 'sub-1' })
    mockResolve.mutateAsync.mockResolvedValue(RESOLVED)
  })

  it('sends the token the preview returned', async () => {
    await openWithPreview()

    await pressSubmit()

    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        googlePlaceId: 'ChIJtest',
        resolutionToken: 'token-from-the-preview',
      }),
    )
  })

  it('re-resolves once and resubmits when the token has expired', async () => {
    mockSubmit.mutateAsync
      .mockRejectedValueOnce(staleToken())
      .mockResolvedValueOnce({ status: 'PENDING', submissionId: 'sub-2' })
    mockResolve.mutateAsync.mockResolvedValue({
      ...RESOLVED,
      resolutionToken: 'token-from-the-retry',
    })

    await openWithPreview()
    await pressSubmit()

    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(2)
    // The user is never asked to paste the link again.
    expect(mockResolve.mutateAsync).toHaveBeenCalledWith({ url: LINK })
    expect(mockSubmit.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ resolutionToken: 'token-from-the-retry' }),
    )
  })

  it('retries exactly once — a stale token can never become a loop', async () => {
    mockSubmit.mutateAsync.mockRejectedValue(staleToken())

    await openWithPreview()
    await pressSubmit()

    // Two attempts, and the act above already drained everything a third would
    // have been scheduled by.
    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(2)
    expect(mockResolve.mutateAsync).toHaveBeenCalledTimes(1)
  })

  it('does not resubmit when the re-resolve says something new', async () => {
    mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
    // The place closed, or the link now matches several branches. That is an
    // answer for the user, not something to send on their behalf.
    mockResolve.mutateAsync.mockResolvedValue({
      status: 'CANDIDATE_SELECTION',
      reasonCodes: ['AMBIGUOUS'],
      candidates: [],
    })

    await openWithPreview()
    await pressSubmit()

    expect(mockResolve.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
  })

  it('submits without a token rather than failing, when the preview issued none', async () => {
    mockResolve.data = { ...RESOLVED, resolutionToken: undefined }
    await renderScreen(<PlaceImportScreen />)

    await pressSubmit()

    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mockSubmit.mutateAsync.mock.calls[0][0]).not.toHaveProperty('resolutionToken')
  })

  /**
   * The token is a capability. It authorises nothing on its own, but it has no
   * business in an analytics pipeline either — and a payload spread into an
   * event is exactly how that happens by accident.
   */
  it('never puts the token into analytics', async () => {
    await openWithPreview()
    await pressSubmit()

    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
    for (const call of mockTrack.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('token-from-the-preview')
    }
  })
})
