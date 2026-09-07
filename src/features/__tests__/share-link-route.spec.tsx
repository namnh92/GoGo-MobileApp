import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react-native'
import type { ReactElement } from 'react'

/**
 * GoGo-MobileApp#139. AASA claims `/l/*` and `app.config.ts` claims the domain,
 * so a click on a canonical share link opens the app — and before this route
 * existed it opened onto expo-router's developer "Unmatched Route" page, in
 * English, with the raw URL printed on it.
 *
 * The screen resolves the slug and then replaces itself, so what is worth
 * asserting is where each answer sends the person, and that the two dead-link
 * codes read as different sentences from a network failure.
 */
const mockReplace = jest.fn()
const mockResolveShareLink = jest.fn()
// jest hoists the factory above this file's body, so anything it closes over
// must be named `mock*` — that prefix is the allowance babel-plugin-jest-hoist
// makes.
let mockParams: Record<string, string> = { slug: 'Af82Xc' }

// One stable object, the way expo-router's own hook behaves — a fresh one each
// render would hide a re-render loop rather than catch it.
const mockRouter = { replace: mockReplace }

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@/shared/api/endpoints/share-links', () => ({
  resolveShareLink: (...args: unknown[]) => mockResolveShareLink(...args),
}))

import { ApiError } from '@/shared/api/errors'
import ShareLinkScreen from '@/features/deep-link/share-link.view'

function apiError(status: number): ApiError {
  return new ApiError(status, {
    code: status === 410 ? 'SHARE_LINK_GONE' : 'NOT_FOUND',
    message: 'gone',
    field_errors: [],
    request_id: 'test',
    retryable: false,
  })
}

/**
 * The screen resolves through TanStack Query, so it needs a client. Retries are
 * off here: the screen's own retry policy is a separate concern, and leaving
 * them on would make a "transient failure" case wait for backoff before the
 * assertion it is actually about.
 */
function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { slug: 'Af82Xc' }
})

describe('share link route', () => {
  it('sends a room invite to the join screen, using the slug as the invite code', async () => {
    mockResolveShareLink.mockResolvedValue({
      type: 'ROOM_INVITE',
      target: { inviteCode: 'Af82Xc' },
      expiresAt: null,
      provider: 'NONE',
      trackingUrl: null,
      source: null,
      campaign: null,
    })

    render(<ShareLinkScreen />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/r/Af82Xc'))
  })

  it('sends a plan link to the plan screen', async () => {
    const planId = '311f5bd8-f853-4ced-af68-e04398d1451a'
    mockResolveShareLink.mockResolvedValue({
      type: 'PLAN',
      target: { planId },
      expiresAt: null,
      provider: 'NONE',
      trackingUrl: null,
      source: null,
      campaign: null,
    })

    render(<ShareLinkScreen />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/plans/${planId}`))
  })

  it('sends a place link to the place screen', async () => {
    const placeId = '8f61a751-bd5a-43d0-a7e8-c838881d8b81'
    mockResolveShareLink.mockResolvedValue({
      type: 'PLACE',
      target: { placeId },
      expiresAt: null,
      provider: 'NONE',
      trackingUrl: null,
      source: null,
      campaign: null,
    })

    render(<ShareLinkScreen />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/places/${placeId}`))
  })

  it.each([404, 410])('explains a dead link (%i) instead of navigating', async status => {
    mockResolveShareLink.mockRejectedValue(apiError(status))

    render(<ShareLinkScreen />)

    await waitFor(() => expect(screen.getByText('Liên kết không còn dùng được')).toBeTruthy())
    expect(mockReplace).not.toHaveBeenCalled()
    // A dead link cannot be retried into life; only the way home is offered.
    expect(screen.queryByText('Thử lại')).toBeNull()
  })

  it('offers a retry when the resolve fails for a transient reason', async () => {
    mockResolveShareLink.mockRejectedValue(new Error('network down'))

    render(<ShareLinkScreen />)

    await waitFor(() => expect(screen.getByText('Chưa mở được liên kết')).toBeTruthy())
    expect(screen.getByText('Thử lại')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says so when the build does not know the link type, rather than dropping to home', async () => {
    mockResolveShareLink.mockResolvedValue({
      type: 'COLLECTION',
      target: { collectionId: 'winter-picks' },
      expiresAt: null,
      provider: 'NONE',
      trackingUrl: null,
      source: null,
      campaign: null,
    })

    render(<ShareLinkScreen />)

    await waitFor(() =>
      expect(screen.getByText('Bản app này chưa mở được link đó')).toBeTruthy(),
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
