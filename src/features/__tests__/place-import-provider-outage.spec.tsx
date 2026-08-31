import { screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import { ApiError } from '@/shared/api/errors'

/**
 * APP-036 — the Add Place screen must not report GoGo's own outage as a fact
 * about the user's link.
 *
 * On 2026-09-01 a real café (Lacaph Coffee Experiences Space) came back from
 * DEV as `UNRESOLVED / NOT_FOUND` because the backend could not reach Google at
 * all, and this screen printed "Không tìm thấy địa điểm trên Google Maps."
 * GoGo-BE#279 makes that case a 503; this is the half that reads it.
 */

const mockResolve = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
  data: undefined as unknown,
}

const mockIdleMutation = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
}

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockIdleMutation,
  usePlaceSubmission: () => ({ data: undefined }),
  useTaxonomies: () => ({ data: undefined }),
}))

import PlaceImportScreen from '@/features/place-import/import.view'

function failWith(error: unknown): void {
  mockResolve.isError = true
  mockResolve.error = error
  mockResolve.data = undefined
}

describe('APP-036 — Add Place separates a provider outage from a missing place', () => {
  beforeEach(() => {
    mockResolve.isError = false
    mockResolve.error = null
    mockResolve.data = undefined
  })

  it('says the service cannot verify right now on PLACE_PROVIDER_UNAVAILABLE', async () => {
    failWith(
      new ApiError(503, {
        code: 'PLACE_PROVIDER_UNAVAILABLE',
        message: 'GoGo đang tạm thời không xác minh được địa điểm',
        retryable: true,
      }),
    )

    await renderScreen(<PlaceImportScreen />)

    expect(
      screen.getByText('GoGo đang tạm thời không thể xác minh địa điểm. Vui lòng thử lại sau.'),
    ).toBeTruthy()
    // The sentence that must never appear for our own outage.
    expect(screen.queryByText('Không tìm thấy địa điểm trên Google Maps.')).toBeNull()
    // Nor the title, which reads as a verdict on the place itself.
    expect(screen.queryByText('Không thể thêm địa điểm này')).toBeNull()
  })

  it('reads any 503 the same way, whatever code it carries', async () => {
    failWith(new ApiError(503, { code: 'SOMETHING_NEW', message: 'unavailable' }))

    await renderScreen(<PlaceImportScreen />)

    expect(
      screen.getByText('GoGo đang tạm thời không thể xác minh địa điểm. Vui lòng thử lại sau.'),
    ).toBeTruthy()
  })

  it('keeps the rate-limit copy on 429', async () => {
    failWith(new ApiError(429, { code: 'RATE_LIMITED', message: 'slow down' }))

    await renderScreen(<PlaceImportScreen />)

    expect(screen.getByText('Bạn thử hơi nhiều lần. Đợi một chút rồi thử lại.')).toBeTruthy()
  })

  it('still tells the user a genuine miss is a genuine miss', async () => {
    // Not an error at all: the BFF answered 201 and Google found nothing.
    mockResolve.data = { status: 'UNRESOLVED', reasonCodes: ['NOT_FOUND'] }

    await renderScreen(<PlaceImportScreen />)

    expect(screen.getByText('Không tìm thấy địa điểm trên Google Maps.')).toBeTruthy()
    expect(screen.getByText('Không thể thêm địa điểm này')).toBeTruthy()
  })
})
