import { completeWizard } from './contribution-fixtures'
import { fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockSubmissionId = jest.fn()
const mockSubmit = { data: {} as Record<string, unknown>, isSuccess: true, reset: jest.fn() }
const mockResolve = { data: { status: 'RESOLVED', candidate: { googlePlaceId: 'google', name: 'Quán' } }, mutate: jest.fn((_body, callbacks) => { if (mockResolve.data) callbacks?.onSuccess?.(mockResolve.data); else callbacks?.onError?.(undefined) }), reset: jest.fn() }
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }))
jest.mock('expo-router', () => ({ useNavigation: () => ({ dispatch: jest.fn() }), useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/features/place-import/existing-place-result.view', () => ({
  ExistingPlaceResult: ({ placeId }: { placeId: string }) => {
    const { Text } = jest.requireActual('react-native')
    return <Text>{`canonical:${placeId}`}</Text>
  },
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useResolveGoogleMapsLink: () => mockResolve,
  useSubmitPlace: () => mockSubmit,
  submitPlace: async () => mockSubmit.data,
  usePlaceSubmission: (id: string | undefined) => { mockSubmissionId(id); return {} },
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
}))
import PlaceImportScreen from '@/features/place-import/import.view'

async function open() {
  await renderScreen(<PlaceImportScreen />)
  await fireEvent.changeText(screen.getByPlaceholderText('Dán link Google Maps tại đây...'), 'https://maps.app.goo.gl/A')
  await fireEvent.press(screen.getByText('Tiếp tục trích xuất thông tin'))
  await completeWizard()
  await fireEvent.press(screen.getByText('Gửi'))
}
beforeEach(() => { mockSubmissionId.mockClear(); mockSubmit.data = { status: 'PENDING', submissionId: 's' } })

it('keeps canonical-place actions without polling', async () => {
  mockSubmit.data = { status: 'ALREADY_EXISTS', placeId: 'gogo' }
  await open()
  expect(screen.getByText('canonical:gogo')).toBeTruthy()
  expect(mockSubmissionId).not.toHaveBeenCalled()
})

it('does not poll deduplicated submissions or show the obsolete inline moderation result', async () => {
  mockSubmit.data = { status: 'PENDING', submissionId: 's', deduped: true }
  await open()
  expect(mockSubmissionId).not.toHaveBeenCalled()
  expect(screen.queryByText('✓ Đã gửi — GoGo sẽ duyệt trước khi hiển thị.')).toBeNull()
  expect(screen.queryByText('Đang chờ kiểm duyệt')).toBeNull()
  expect(screen.queryByText('Đề xuất này đang được xử lý. Chỉ người gửi đầu tiên có thể xem tiến trình tại đây.')).toBeNull()
})
