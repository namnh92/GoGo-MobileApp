import { fireEvent, screen } from '@testing-library/react-native'
import { ApiError } from '@/shared/api/errors'
import { renderScreen } from './harness'

let mockStatus = 'user'
const mockSubmissionId = jest.fn()
const mockSubmit: { data: Record<string, unknown>; isSuccess: boolean; reset: jest.Mock } = { data: {}, isSuccess: true, reset: jest.fn() }
let mockSubmission: Record<string, unknown> = {}
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/features/place-import/existing-place-result.view', () => ({
  ExistingPlaceResult: ({ placeId }: { placeId: string }) => {
    const { Text } = jest.requireActual('react-native')
    return <Text>{`canonical:${placeId}`}</Text>
  },
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => ({ data: { status: 'RESOLVED', candidate: { googlePlaceId: 'google', name: 'Quán' } }, mutate: jest.fn(), reset: jest.fn() }),
  useSubmitPlace: () => mockSubmit,
  usePlaceSubmission: (id: string | undefined) => { mockSubmissionId(id); return mockSubmission },
  useTaxonomies: () => ({ data: undefined }),
}))
import PlaceImportScreen from '@/features/place-import/import.view'

async function open() {
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), 'https://maps.app.goo.gl/A')
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
}
beforeEach(() => { mockStatus = 'user'; mockSubmissionId.mockClear(); mockSubmission = {}; mockSubmit.data = { status: 'PENDING', submissionId: 's' } })

it('opens a canonical ID returned directly by submit without polling a missing submission ID', async () => {
  mockSubmit.data = { status: 'ALREADY_EXISTS', placeId: 'gogo' }
  await open()
  expect(screen.getByText('canonical:gogo')).toBeTruthy()
  expect(mockSubmissionId).toHaveBeenLastCalledWith(undefined)
})

it('treats a deduped owner-only poll as inaccessible progress rather than rejection', async () => {
  mockSubmit.data = { status: 'PENDING', submissionId: 's', deduped: true }
  mockSubmission = { isError: true, error: new ApiError(403, { code: 'FORBIDDEN', message: 'Owner only' }) }
  await open()
  expect(screen.getByText('Đề xuất này đang được xử lý. Chỉ người gửi đầu tiên có thể xem tiến trình tại đây.')).toBeTruthy()
  expect(screen.queryByText('Bị từ chối')).toBeNull()
})

it.each(['approved', 'merged'])('opens the destination of a %s submission', async status => {
  mockSubmission = { data: { status, placeId: 'destination' } }
  await open()
  expect(screen.getByText('canonical:destination')).toBeTruthy()
})
