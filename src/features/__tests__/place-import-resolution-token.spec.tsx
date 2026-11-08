import { completeWizard } from './contribution-fixtures'
import { act, fireEvent, screen, within, waitFor } from '@testing-library/react-native'
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
  mutate: jest.fn((_body, callbacks) => { if (mockResolve.data) callbacks?.onSuccess?.(mockResolve.data); else callbacks?.onError?.(undefined) }),
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

jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }),
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
  resolveGoogleMapsLink: (body: unknown) => mockResolve.mutateAsync(body),
  useSubmitPlace: () => mockSubmit,
  submitPlace: (body: unknown) => mockSubmit.mutateAsync(body),
  usePlaceSubmission: () => ({ data: undefined }),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
}))

import PlaceImportScreen from '@/features/place-import/import.view'

const LINK = 'https://maps.google.com/maps?place_id=ChIJtest'

/**
 * The CTA's handler is async, so the press has to be awaited inside one `act`.
 * Pressing outside it and polling with `waitFor` leaves React with overlapping
 * `act()` scopes, and the renderer does not recover for the rest of the file.
 */
async function pressSubmit(): Promise<void> {
  await completeWizard()
  await act(async () => {
    await fireEvent.press(screen.getByText('Gửi'))
  })
}

const staleToken = () =>
  new ApiError(400, {
    code: 'RESOLUTION_TOKEN_INVALID',
    message: 'Cần mở lại liên kết để xác minh địa điểm rồi thử lại',
    retryable: true,
  })

async function openWithPreview(result: Omit<typeof RESOLVED, 'resolutionToken'> & { resolutionToken?: string } = RESOLVED): Promise<void> {
  mockResolve.data = result
  await renderScreen(<PlaceImportScreen />)
  // The screen re-resolves from its own input, so the link has to be in it.
  // Both the typing and the press go through `act`: an unwrapped state update
  // here leaves React with an open act scope, and every later render in the
  // file comes back empty.
  await act(async () => {
    await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), LINK)
  })
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
}

  beforeEach(() => {
    mockResolve.mutate.mockClear()
    mockResolve.mutateAsync.mockReset()
    mockSubmit.mutate.mockClear()
    mockSubmit.mutateAsync.mockReset()
    mockTrack.mockClear()
    mockResolve.data = undefined
    mockSubmit.isError = false
    mockSubmit.isPending = false
    mockSubmit.isSuccess = false
    mockSubmit.data = undefined
    mockSubmit.mutateAsync.mockResolvedValue({ status: 'PENDING', submissionId: 'sub-1' })
    mockResolve.mutateAsync.mockResolvedValue(RESOLVED)
  })

describe('APP-042 — the resolve proof reaches submit', () => {


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
    await completeWizard()
    await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Keep this note')
    await pressSubmit()

    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(2)
    // The user is never asked to paste the link again.
    expect(mockResolve.mutateAsync).toHaveBeenCalledWith({ url: LINK })
    expect(mockSubmit.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ resolutionToken: 'token-from-the-retry', enrichment: expect.objectContaining({ visitTips: 'Keep this note' }) }),
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

    mockSubmit.reset.mockClear()
    await openWithPreview()
    await pressSubmit()

    expect(mockResolve.mutateAsync).toHaveBeenCalledTimes(1)
    expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
    // Re-resolve is an imperative guarded request; no mutation cache can retain the refusal.
    expect(screen.queryByText('Chưa gửi được')).toBeNull()
  })

  it('submits without a token rather than failing, when the preview issued none', async () => {
    await openWithPreview({ ...RESOLVED, resolutionToken: undefined })

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


async function changeVerifiedLink() {
  await fireEvent.press(within(screen.getByTestId('import-header')).getByRole('button', { name: 'Quay lại' }))
  const exit = screen.queryByTestId('contribution-exit')
  if (exit) await fireEvent.press(within(exit).getByRole('button', { name: 'Không lưu' }))
  await waitFor(() => expect(screen.queryByTestId('contribution-wizard')).toBeNull())
}

it('invalidates A preview when the user edits the link to B', async () => {
  await openWithPreview()
  if (screen.queryByTestId('import-synced-link')) await changeVerifiedLink()
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), 'https://maps.app.goo.gl/B')
  expect(screen.queryByText('Gửi')).toBeNull()
  expect(mockSubmit.mutateAsync).not.toHaveBeenCalled()
})

it('does not retry A after a stale-token resolve returns while the user is on B', async () => {
  mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
  let finish: (value: unknown) => void = () => {}
  mockResolve.mutateAsync.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await openWithPreview()
  await pressSubmit()
  if (screen.queryByTestId('import-synced-link')) await changeVerifiedLink()
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), 'https://maps.app.goo.gl/B')
  await act(async () => { finish(RESOLVED) })
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Quán Thử')).toBeNull()
})

it.each(['resolve', 'submit'] as const)('rejects the old %s continuation after editing A→B→A', async pendingStep => {
  let finish: () => void = () => {}
  if (pendingStep === 'resolve') {
    mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
    mockResolve.mutateAsync.mockImplementation(() => new Promise(resolve => { finish = () => resolve(RESOLVED) }))
  } else {
    mockSubmit.mutateAsync.mockImplementationOnce(() => new Promise((_resolve, reject) => { finish = () => reject(staleToken()) }))
  }
  await openWithPreview()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Old A note')
  await pressSubmit()
  await changeVerifiedLink()
  const input = screen.getByPlaceholderText('Dán link Google Maps tại đây...')
  await fireEvent.changeText(input, 'https://maps.app.goo.gl/B')
  await fireEvent.changeText(input, LINK)
  await act(async () => { finish() })

  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
  expect(mockSubmit.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ enrichment: expect.objectContaining({ visitTips: 'Old A note' }) }))
  expect(mockResolve.mutateAsync).toHaveBeenCalledTimes(pendingStep === 'resolve' ? 1 : 0)
  expect(screen.queryByText('Gửi')).toBeNull()
})

it('keeps a new attempt locked when an outdated retry finishes', async () => {
  let finishOld: (value: unknown) => void = () => {}
  let finishNew: (value: unknown) => void = () => {}
  mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve }))
  mockResolve.mutateAsync.mockImplementation(() => new Promise(resolve => { finishOld = resolve }))
  await openWithPreview()
  await pressSubmit()
  if (screen.queryByTestId('import-synced-link')) await changeVerifiedLink()
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), 'https://maps.app.goo.gl/B')
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  await pressSubmit()
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(2)
  await act(async () => { finishOld(RESOLVED) })
  await pressSubmit()
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(2)
  await act(async () => { finishNew({ status: 'PENDING', submissionId: 'new' }) })
})

it('does not attach an existing contribution to a different provider identity after revalidation', async () => {
  mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
  mockResolve.mutateAsync.mockResolvedValue({ ...RESOLVED, candidate: { ...RESOLVED.candidate, googlePlaceId: 'ChIJdifferent' }, resolutionToken: 'different-proof' })
  await openWithPreview()
  await pressSubmit()
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
  expect(mockResolve.mutateAsync).toHaveBeenCalledTimes(1)
})


it('keeps entered form values when stale-token revalidation loses the network', async () => {
  await openWithPreview()
  await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Keep on revalidation failure')
  mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
  mockResolve.mutateAsync.mockImplementationOnce(async () => {
    mockResolve.data = undefined
    throw new Error('network unavailable')
  })
  await pressSubmit()
  expect(screen.getByText('Chưa gửi được')).toBeTruthy()
  expect(screen.getByLabelText('Món ngon & mẹo').props.value).toBe('Keep on revalidation failure')
  expect(mockSubmit.mutateAsync).toHaveBeenCalledTimes(1)
})

const BRANCHES = {
  status: 'CANDIDATE_SELECTION',
  candidates: [
    { ...RESOLVED.candidate, googlePlaceId: 'branch-A', name: 'Branch A' },
    { ...RESOLVED.candidate, googlePlaceId: 'branch-B', name: 'Branch B' },
  ],
}

async function openBranches() {
  mockResolve.data = BRANCHES
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), LINK)
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  await fireEvent.press(screen.getByText('Branch A'))
}

it.each(['submit', 'revalidation'] as const)('F-01 locks branch selection during %s', async (phase) => {
  let finish: () => void = () => {}
  if (phase === 'submit') {
    mockSubmit.mutateAsync.mockImplementationOnce(() => {
      mockSubmit.isPending = true
      return new Promise(resolve => { finish = () => {
        mockSubmit.isPending = false
        resolve({ status: 'PENDING', submissionId: 'A' })
      } })
    })
  } else {
    mockSubmit.mutateAsync.mockRejectedValueOnce(staleToken())
    mockResolve.mutateAsync.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ status: 'CANDIDATE_SELECTION', candidates: BRANCHES.candidates })
    }))
  }
  await openBranches()
  await pressSubmit()
  await screen.rerender(<PlaceImportScreen />)
  await fireEvent.press(screen.getByRole('button', { name: /Branch B/ }))
  expect(screen.getByRole('button', { name: /Branch A/ }).props.accessibilityState).toMatchObject({ selected: true, disabled: true })
  expect(screen.getByRole('button', { name: /Branch B/ }).props.accessibilityState).toMatchObject({ selected: false, disabled: true })
  await act(async () => { finish() })
  if (phase === 'submit') {
    expect(within(screen.getByTestId('place-preview-compact')).getByText('Branch A')).toBeTruthy()
  } else {
    expect(screen.getByRole('button', { name: /Branch B/ }).props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(screen.getByRole('button', { name: /Branch B/ }))
    await pressSubmit()
    expect(mockSubmit.mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ googlePlaceId: 'branch-B' }))
  }
})

it('F-01 binds success identity to the captured submission when the preview changes', async () => {
  let finish: () => void = () => {}
  mockSubmit.mutateAsync.mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve({ status: 'PENDING', submissionId: 'A' })
  }))
  await openBranches()
  await pressSubmit()
  mockResolve.data = { ...BRANCHES, candidates: [
    { ...BRANCHES.candidates[0], name: 'Changed preview' }, BRANCHES.candidates[1],
  ] }
  await screen.rerender(<PlaceImportScreen />)
  await act(async () => { finish() })
  const result = within(screen.getByTestId('result-sheet'))
  expect(result.getByText('Branch A đã được gửi cho GoGo duyệt. Bạn sẽ nhận thông báo khi có kết quả')).toBeTruthy()
  expect(within(screen.getByTestId('place-preview-compact')).getByText('Branch A')).toBeTruthy()
})
