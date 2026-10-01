import { act, fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import { ApiError } from '@/shared/api/errors'

/**
 * APP-036 / #131 — Google's `FUTURE_OPENING` (announced, not trading yet) now
 * reaches the add-by-link preview as itself (GoGo-BE#339). With no key for it
 * the screen said "Google has not confirmed this place is operating", which is
 * wrong in the one way that matters: the status is known. And the submit that
 * followed was refused with 409 `PLACE_NOT_YET_OPEN`, shown as a generic
 * failure. The screen now names the status, does not offer a submit the server
 * will refuse, and reads the refusal if it still arrives.
 */

const candidate = (businessStatus: string) => ({
  status: 'RESOLVED',
  reasonCodes: ['EXACT_PROVIDER_ID'],
  candidate: {
    googlePlaceId: 'ChIJsoon',
    name: 'Quán Sắp Mở',
    address: '2 Đường Mới, Quận 3',
    location: { lat: 10.78, lng: 106.69 },
    businessStatus,
    source: 'google_places',
    fetchedAt: '2026-10-01T10:00:00.000Z',
    attributions: [],
  },
})

const mockResolve = {
  mutate: jest.fn(),
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

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockSubmit,
  usePlaceSubmission: () => ({ data: undefined }),
  useTaxonomies: () => ({ data: undefined }),
}))

import PlaceImportScreen from '@/features/place-import/import.view'

const NOT_YET_OPEN = 'Google báo địa điểm này chưa khai trương. Thêm lại khi quán đã mở cửa nhé.'
const UNKNOWN = '⚠️ Google chưa xác nhận địa điểm còn hoạt động.'
const GENERIC_FAILURE = 'Gửi không thành công. Thử lại nhé.'
const SUBMIT = 'Gửi địa điểm cho GoGo'

beforeEach(() => {
  jest.clearAllMocks()
  mockSubmit.isError = false
  mockSubmit.error = null
  mockSubmit.mutateAsync.mockResolvedValue({ status: 'PENDING_REVIEW' })
})

it('names a place that has not opened yet instead of calling its status unknown', async () => {
  mockResolve.data = candidate('FUTURE_OPENING')
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByText(`⚠️ ${NOT_YET_OPEN}`)).toBeTruthy()
  expect(screen.queryByText(UNKNOWN)).toBeNull()
})

it('does not offer a submit the server will refuse, and says why', async () => {
  mockResolve.data = candidate('FUTURE_OPENING')
  await renderScreen(<PlaceImportScreen />)
  const button = screen.getByRole('button', { name: SUBMIT })
  expect(button.props.accessibilityState?.disabled).toBe(true)
  await act(async () => {
    fireEvent.press(screen.getByText(SUBMIT))
  })
  expect(mockSubmit.mutateAsync).not.toHaveBeenCalled()
})

it('reads a PLACE_NOT_YET_OPEN refusal as that, not a generic failure', async () => {
  // Preview said operating; by submit time Google says "opening soon".
  mockResolve.data = candidate('OPERATIONAL')
  mockSubmit.isError = true
  mockSubmit.error = new ApiError(409, { code: 'PLACE_NOT_YET_OPEN', message: 'chưa khai trương' })
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByText(NOT_YET_OPEN)).toBeTruthy()
  expect(screen.queryByText(GENERIC_FAILURE)).toBeNull()
})

it('keeps the generic failure for other refusals', async () => {
  mockResolve.data = candidate('OPERATIONAL')
  mockSubmit.isError = true
  mockSubmit.error = new ApiError(500, { code: 'INTERNAL', message: 'boom' })
  await renderScreen(<PlaceImportScreen />)
  expect(screen.getByText(GENERIC_FAILURE)).toBeTruthy()
})

it('still offers submit for an operating place', async () => {
  mockResolve.data = candidate('OPERATIONAL')
  await renderScreen(<PlaceImportScreen />)
  const button = screen.getByRole('button', { name: SUBMIT })
  expect(button.props.accessibilityState?.disabled).not.toBe(true)
})
